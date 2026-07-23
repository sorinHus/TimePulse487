from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Department
from attendance.models import Notification
from .models import PontajEntry, PontajSheet
from .pontaj import get_or_create_sheet
from .serializers import PontajEntrySerializer, PontajSheetSerializer

User = get_user_model()

EDITABLE_STATUSES = ('draft', 'rejected')


def _can_view_department(user, department):
    """Read access: admin/director see any department, manager only their own."""
    if user.effective_role in ['admin', 'director']:
        return True
    return user.effective_role == 'manager' and user.department_id == department.id


def _can_edit_department(user, department):
    """Write access (edit cells, generate): admin or the department's own manager.
    Director deliberately excluded — director only reviews (approve/reject)."""
    if user.effective_role == 'admin':
        return True
    return user.effective_role == 'manager' and user.department_id == department.id


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
        return Response(PontajSheetSerializer(sheet).data)


class PontajEntryDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        try:
            entry = PontajEntry.objects.select_related('sheet__department').get(pk=pk)
        except PontajEntry.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        if not _can_edit_department(request.user, entry.sheet.department):
            return Response({'detail': 'Permission denied.'}, status=403)
        if entry.sheet.status not in EDITABLE_STATUSES:
            return Response({'detail': 'This pontaj sheet can no longer be edited.'}, status=400)

        if 'hours' in request.data:
            entry.hours = request.data['hours']
            entry.leave_code = ''
        elif 'leave_code' in request.data:
            entry.leave_code = (request.data['leave_code'] or '').strip().upper()
            entry.hours = None
        else:
            return Response({'detail': 'Provide either hours or leave_code.'}, status=400)

        entry.is_edited = True
        entry.save(update_fields=['hours', 'leave_code', 'is_edited', 'updated_at'])
        return Response(PontajEntrySerializer(entry).data)


class PontajSheetGenerateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            sheet = PontajSheet.objects.select_related('department').get(pk=pk)
        except PontajSheet.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        if not _can_edit_department(request.user, sheet.department):
            return Response({'detail': 'Permission denied.'}, status=403)
        if sheet.status not in EDITABLE_STATUSES:
            return Response({'detail': 'Only draft or rejected sheets can be submitted.'}, status=400)

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
            )

        return Response(PontajSheetSerializer(sheet).data)
