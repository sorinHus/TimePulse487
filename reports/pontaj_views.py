import calendar
from collections import defaultdict

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Department
from attendance.models import Notification
from .models import PontajEntry, PontajSheet
from .pontaj import (
    EDITABLE_STATUSES,
    build_day_maps,
    compute_pontaj_cell,
    get_or_create_personal_sheet,
    get_or_create_sheet,
    sync_leave_requests,
)
from .serializers import PontajSheetSerializer

User = get_user_model()


def _can_view_department(user, department):
    """Read access: admin/director see any department, manager only their own."""
    if user.effective_role in ['admin', 'director']:
        return True
    return user.effective_role == 'manager' and user.department_id == department.id


def _can_edit_department(user, department):
    """Write access (edit cells, save, submit): admin or the department's own
    manager. Director deliberately excluded — director only reviews (approve/reject)."""
    if user.effective_role == 'admin':
        return True
    return user.effective_role == 'manager' and user.department_id == department.id


def _can_view_sheet(user, sheet):
    """Personal sheets (no department, self-service): only the owner or an
    admin. Department sheets: existing department-based rule."""
    if sheet.user_id:
        return user.id == sheet.user_id or user.effective_role == 'admin'
    return _can_view_department(user, sheet.department)


def _can_edit_sheet(user, sheet):
    if sheet.user_id:
        return user.id == sheet.user_id or user.effective_role == 'admin'
    return _can_edit_department(user, sheet.department)


def _sheet_link(sheet):
    if sheet.user_id:
        return f'/pontaj?self=1&year={sheet.year}&month={sheet.month}'
    return f'/pontaj?department_id={sheet.department_id}&year={sheet.year}&month={sheet.month}'


def _apply_entries(sheet, entries_payload):
    """Aplica local, peste PontajEntry-urile sheet-ului, o lista de
    {id, hours, leave_code} trimisa de client (folosita de Salveaza si de
    Trimite la DG, care poate salva modificarile nesalvate inainte de a
    schimba starea)."""
    if not entries_payload:
        return

    ids = [item.get('id') for item in entries_payload if item.get('id')]
    entries_by_id = {e.id: e for e in PontajEntry.objects.filter(sheet=sheet, id__in=ids)}

    now = timezone.now()
    to_update = []
    for item in entries_payload:
        entry = entries_by_id.get(item.get('id'))
        if not entry:
            continue
        leave_code = (item.get('leave_code') or '').strip().upper()
        if leave_code:
            entry.leave_code = leave_code
            entry.hours = None
        else:
            entry.leave_code = ''
            hours = item.get('hours')
            entry.hours = hours if hours not in (None, '') else None
        entry.is_edited = True
        entry.leave_from_request = False
        entry.updated_at = now
        to_update.append(entry)

    if to_update:
        PontajEntry.objects.bulk_update(
            to_update, ['hours', 'leave_code', 'is_edited', 'leave_from_request', 'updated_at']
        )


class PontajSheetView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        department_id = request.query_params.get('department_id')
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        if not (department_id and year and month):
            return Response({'detail': 'department_id, year and month are required.'}, status=400)

        try:
            department = Department.objects.get(id=department_id)
        except Department.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        if not _can_view_department(request.user, department):
            return Response({'detail': 'Permission denied.'}, status=403)

        sheet = get_or_create_sheet(department, int(year), int(month))
        sync_leave_requests(sheet)
        return Response(PontajSheetSerializer(sheet).data)


class PontajPersonalSheetView(APIView):
    """Pontaj individual, fara departament — pentru cineva care isi genereaza
    si isi aproba singur pontajul (ex. directorul general)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        if not (year and month):
            return Response({'detail': 'year and month are required.'}, status=400)

        sheet = get_or_create_personal_sheet(request.user, int(year), int(month))
        sync_leave_requests(sheet)
        return Response(PontajSheetSerializer(sheet).data)


class PontajOrgOverviewView(APIView):
    """Vedere combinata, doar-citire, cu toti angajatii din toate
    departamentele intr-un singur tabel — pentru directorul general, care
    altfel ar trebui sa deschida foaia fiecarui departament pe rand.
    Actiunile de aprobare/respingere raman pe foaia fiecarui departament
    (vezi sheet_id/department_id per rand, folosite pentru link)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.effective_role not in ['admin', 'director']:
            return Response({'detail': 'Permission denied.'}, status=403)

        year = request.query_params.get('year')
        month = request.query_params.get('month')
        if not (year and month):
            return Response({'detail': 'year and month are required.'}, status=400)
        year, month = int(year), int(month)

        dept_ids_with_staff = set(
            User.objects.filter(is_active=True, department__isnull=False)
            .values_list('department_id', flat=True).distinct()
        )
        rows = []
        for dept in Department.objects.filter(id__in=dept_ids_with_staff).order_by('name'):
            sheet = get_or_create_sheet(dept, year, month)
            sync_leave_requests(sheet)
            data = PontajSheetSerializer(sheet).data
            for row in data['rows']:
                row['department_id'] = dept.id
                row['department_name'] = dept.name
                row['sheet_id'] = sheet.id
                row['sheet_status'] = sheet.status
                rows.append(row)

        personal_users = User.objects.filter(
            department__isnull=True, is_active=True
        ).order_by('last_name', 'first_name')
        for u in personal_users:
            sheet = get_or_create_personal_sheet(u, year, month)
            sync_leave_requests(sheet)
            data = PontajSheetSerializer(sheet).data
            for row in data['rows']:
                row['department_id'] = None
                row['department_name'] = None
                row['sheet_id'] = sheet.id
                row['sheet_status'] = sheet.status
                rows.append(row)

        num_days = calendar.monthrange(year, month)[1]
        from leaves.utils import get_public_holidays_named
        holidays = {d.day: name for d, name in get_public_holidays_named(year).items() if d.month == month}

        return Response({
            'year': year,
            'month': month,
            'num_days': num_days,
            'holidays': holidays,
            'rows': rows,
        })


class PontajSheetSaveView(APIView):
    """Salveaza pe server modificarile facute local in grila (fara sa
    schimbe starea foii si fara sa notifice pe nimeni)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            sheet = PontajSheet.objects.select_related('department').get(pk=pk)
        except PontajSheet.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        if not _can_edit_sheet(request.user, sheet):
            return Response({'detail': 'Permission denied.'}, status=403)
        if sheet.status not in EDITABLE_STATUSES:
            return Response({'detail': 'This pontaj sheet can no longer be edited.'}, status=400)

        _apply_entries(sheet, request.data.get('entries') or [])
        return Response(PontajSheetSerializer(sheet).data)


class PontajSheetRegenerateView(APIView):
    """Recalculeaza (fara sa salveze) valorile celulelor needitate manual pe
    baza pontajului real (sesiuni de lucru + cereri de concediu aprobate).
    Returneaza doar intrarile a caror valoare calculata difera de cea
    curenta, ca managerul sa le revizuiasca inainte de a apasa Salveaza."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            sheet = PontajSheet.objects.select_related('department').get(pk=pk)
        except PontajSheet.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        if not _can_edit_sheet(request.user, sheet):
            return Response({'detail': 'Permission denied.'}, status=403)
        if sheet.status not in EDITABLE_STATUSES:
            return Response({'detail': 'This pontaj sheet can no longer be edited.'}, status=400)

        num_days = calendar.monthrange(sheet.year, sheet.month)[1]
        entries_by_user = defaultdict(list)
        for entry in sheet.entries.filter(is_edited=False).select_related('user'):
            entries_by_user[entry.user_id].append(entry)

        changed = []
        for user_entries in entries_by_user.values():
            user = user_entries[0].user
            session_map, leave_day_map = build_day_maps(user, sheet.year, sheet.month, num_days)
            for entry in user_entries:
                hours, leave_code = compute_pontaj_cell(
                    user, sheet.year, sheet.month, entry.day, session_map, leave_day_map
                )
                current_hours = float(entry.hours) if entry.hours is not None else None
                if hours != current_hours or leave_code != entry.leave_code:
                    changed.append({
                        'id': entry.id,
                        'hours': hours,
                        'leave_code': leave_code,
                        'leave_from_request': bool(leave_code),
                    })

        return Response({'entries': changed})


class PontajSheetSubmitView(APIView):
    """Trimite foaia de pontaj la DG pentru aprobare — blocheaza editarea si
    notifica admin/director. Salveaza si eventualele modificari locale
    nesalvate trimise odata cu cererea, intr-un singur apel.

    Pentru un pontaj personal (fara departament), nu exista cui sa i se
    trimita spre revizuire — se aproba direct (draft/rejected -> approved),
    fara starea intermediara 'generated' si fara notificare."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            sheet = PontajSheet.objects.select_related('department').get(pk=pk)
        except PontajSheet.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        if not _can_edit_sheet(request.user, sheet):
            return Response({'detail': 'Permission denied.'}, status=403)
        if sheet.status not in EDITABLE_STATUSES:
            return Response({'detail': 'Only draft or rejected sheets can be submitted.'}, status=400)

        _apply_entries(sheet, request.data.get('entries') or [])

        if sheet.user_id:
            now = timezone.now()
            sheet.status = 'approved'
            sheet.generated_by = request.user
            sheet.generated_at = now
            sheet.reviewed_by = request.user
            sheet.reviewed_at = now
            sheet.rejection_note = ''
            sheet.save(update_fields=[
                'status', 'generated_by', 'generated_at',
                'reviewed_by', 'reviewed_at', 'rejection_note', 'updated_at',
            ])
            return Response(PontajSheetSerializer(sheet).data)

        sheet.status = 'generated'
        sheet.generated_by = request.user
        sheet.generated_at = timezone.now()
        sheet.rejection_note = ''
        sheet.save(update_fields=['status', 'generated_by', 'generated_at', 'rejection_note', 'updated_at'])

        # Admin/director au acces global, nu neapărat asignați acestui departament.
        reviewers = User.objects.filter(role__in=['admin', 'director'], is_active=True)
        for reviewer in reviewers:
            Notification.objects.create(
                user=reviewer,
                title='Pontaj submitted for approval',
                message=f'{sheet.department.name} — {sheet.year}-{sheet.month:02d} pontaj submitted by {request.user.get_full_name()}.',
                type='system',
                link=_sheet_link(sheet),
                code='pontaj_submitted',
                params={
                    'department': sheet.department.name,
                    'year': sheet.year,
                    'month': f'{sheet.month:02d}',
                    'actor_name': request.user.get_full_name(),
                },
            )

        return Response(PontajSheetSerializer(sheet).data)


class PontajSheetReviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if request.user.effective_role not in ['admin', 'director']:
            return Response({'detail': 'Permission denied.'}, status=403)
        try:
            sheet = PontajSheet.objects.select_related('department').get(pk=pk)
        except PontajSheet.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        action = request.data.get('action')
        if action not in ['approve', 'reject']:
            return Response({'detail': 'Action must be approve or reject.'}, status=400)
        if sheet.status != 'generated':
            return Response({'detail': 'Only generated sheets can be reviewed.'}, status=400)

        rejection_note = (request.data.get('rejection_note') or '').strip()
        if action == 'reject' and not rejection_note:
            return Response({'detail': 'A reason is required for rejection.'}, status=400)

        sheet.status = 'approved' if action == 'approve' else 'rejected'
        sheet.reviewed_by = request.user
        sheet.reviewed_at = timezone.now()
        sheet.rejection_note = rejection_note if action == 'reject' else ''
        sheet.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'rejection_note', 'updated_at'])

        if sheet.generated_by:
            Notification.objects.create(
                user=sheet.generated_by,
                title=f'Pontaj {sheet.status}',
                message=(
                    f'{sheet.department.name} — {sheet.year}-{sheet.month:02d} pontaj was {sheet.status} '
                    f'by {request.user.get_full_name()}.'
                    + (f' Note: {rejection_note}' if rejection_note else '')
                ),
                type='system',
                link=_sheet_link(sheet),
                code='pontaj_reviewed',
                params={
                    'context': sheet.status + ('_note' if rejection_note else ''),
                    'department': sheet.department.name,
                    'year': sheet.year,
                    'month': f'{sheet.month:02d}',
                    'actor_name': request.user.get_full_name(),
                    'note': rejection_note,
                },
            )

        return Response(PontajSheetSerializer(sheet).data)
