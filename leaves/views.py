from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.contrib.auth import get_user_model
from datetime import date, timedelta
from .models import LeaveType, LeaveBalance, LeaveRequest
from .serializers import (
    LeaveTypeSerializer, LeaveBalanceSerializer,
    LeaveRequestSerializer, SickLeaveRegisterSerializer
)

User = get_user_model()


class LeaveTypeListView(generics.ListAPIView):
    queryset = LeaveType.objects.filter(is_active=True)
    serializer_class = LeaveTypeSerializer
    permission_classes = [permissions.IsAuthenticated]


class LeaveBalanceView(generics.ListAPIView):
    serializer_class = LeaveBalanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        year = self.request.query_params.get('year', timezone.now().year)
        return LeaveBalance.objects.filter(user=self.request.user, year=year)


class LeaveRequestListCreateView(generics.ListCreateAPIView):
    serializer_class = LeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.effective_role == 'admin':
            return LeaveRequest.objects.all().select_related('user', 'leave_type')
        if user.effective_role == 'director':
            return LeaveRequest.objects.filter(
                user__role='manager'
            ).select_related('user', 'leave_type')
        if user.effective_role == 'manager':
            return LeaveRequest.objects.filter(
                user__department=user.department
            ).exclude(user=user).select_related('user', 'leave_type')
        return LeaveRequest.objects.filter(user=user).select_related('leave_type')

    def perform_create(self, serializer):
        from .utils import count_working_days
        instance = serializer.save(user=self.request.user)
        instance.total_days = count_working_days(instance.start_date, instance.end_date)
        instance.save(update_fields=['total_days'])


class LeaveRequestDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = LeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.effective_role in ['admin', 'manager']:
            return LeaveRequest.objects.all()
        return LeaveRequest.objects.filter(user=user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != 'pending':
            return Response(
                {'detail': 'Only pending requests can be cancelled.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        instance.status = 'cancelled'
        instance.save()
        return Response({'detail': 'Leave request cancelled.'})


class LeaveApproveRejectView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, action):
        if request.user.effective_role not in ['admin', 'director', 'manager']:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            leave = LeaveRequest.objects.get(pk=pk)
        except LeaveRequest.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        if leave.status != 'pending':
            return Response({'detail': 'Only pending requests can be reviewed.'}, status=status.HTTP_400_BAD_REQUEST)

        if action == 'approve':
            leave.status = 'approved'
            balance, _ = LeaveBalance.objects.get_or_create(
                user=leave.user,
                leave_type=leave.leave_type,
                year=leave.start_date.year,
                defaults={'total_days': leave.leave_type.max_days_per_year}
            )
            balance.used_days += leave.total_days
            balance.save()

            if leave.substitute:
                substitute = leave.substitute
                substitute.temporary_role = leave.user.effective_role
                substitute.temporary_role_start = leave.start_date
                substitute.temporary_role_end = leave.end_date
                substitute.substituting_for = leave.user
                substitute.save(update_fields=[
                    'temporary_role', 'temporary_role_start',
                    'temporary_role_end', 'substituting_for'
                ])

                from attendance.models import Notification
                Notification.objects.create(
                    user=substitute,
                    title='Substitute role assigned',
                    message=(
                        f'You will substitute {leave.user.get_full_name()} '
                        f'({leave.user.effective_role}) from {leave.start_date} to {leave.end_date}. '
                        f'You will have {leave.user.effective_role} permissions during this period.'
                    ),
                    type='system'
                )

        elif action == 'reject':
            leave.status = 'rejected'

        leave.reviewed_by = request.user
        leave.reviewed_at = timezone.now()
        leave.review_note = request.data.get('review_note', '')
        leave.save()

        return Response(LeaveRequestSerializer(leave).data)


class WorkingDaysPreviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        start = request.query_params.get('start')
        end = request.query_params.get('end')
        if not start or not end:
            return Response({'detail': 'start and end required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            start_date = date.fromisoformat(start)
            end_date = date.fromisoformat(end)
            from .utils import count_working_days
            days = count_working_days(start_date, end_date)
            return Response({'working_days': days})
        except Exception as e:
            return Response({'detail': str(e), 'type': type(e).__name__}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ── B10+B13: Înregistrare concediu medical de către manager ──────────────────

def _get_working_days_list(start_date, end_date):
    """Returnează lista de zile lucrătoare între start_date și end_date (inclusiv)."""
    from .utils import count_working_days
    import requests as req
    days = []
    current = start_date
    # Obține zilele libere din API
    try:
        year = start_date.year
        resp = req.get(f'https://zilelibere.webventure.ro/api/v1/{year}', timeout=5)
        holidays = set()
        if resp.status_code == 200:
            for item in resp.json():
                holidays.add(date.fromisoformat(item['date']))
    except Exception:
        holidays = set()

    while current <= end_date:
        if current.weekday() < 5 and current not in holidays:
            days.append(current)
        current += timedelta(days=1)
    return days


def _add_working_days(start_date, n_days):
    """Adaugă n_days zile lucrătoare după start_date, sărind weekenduri și zile libere."""
    import requests as req
    try:
        year = start_date.year
        resp = req.get(f'https://zilelibere.webventure.ro/api/v1/{year}', timeout=5)
        holidays = set()
        if resp.status_code == 200:
            for item in resp.json():
                holidays.add(date.fromisoformat(item['date']))
    except Exception:
        holidays = set()

    current = start_date + timedelta(days=1)
    added = 0
    while added < n_days:
        if current.weekday() < 5 and current not in holidays:
            added += 1
        if added < n_days:
            current += timedelta(days=1)
    return current


class SickLeaveRegisterView(APIView):
    """
    POST /api/leaves/sick-leave/register/
    Doar manager sau admin poate înregistra CM pentru un angajat din echipa sa.
    CM se aprobă automat. Suprapunerile se rezolvă prin return (default) sau extend.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # Verificare permisiuni
        if request.user.effective_role not in ['admin', 'manager']:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = SickLeaveRegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        # Verifică că angajatul există și aparține echipei managerului
        try:
            employee = User.objects.get(pk=data['user_id'])
        except User.DoesNotExist:
            return Response({'detail': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        if request.user.effective_role == 'manager':
            if employee.department != request.user.department:
                return Response(
                    {'detail': 'You can only register sick leave for employees in your department.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Găsește tipul Sick Leave
        try:
            sick_leave_type = LeaveType.objects.get(is_sick_leave=True, is_active=True)
        except LeaveType.DoesNotExist:
            return Response(
                {'detail': 'Sick Leave type not configured. Please contact admin.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from .utils import count_working_days
        start_date = data['start_date']
        end_date = data['end_date']
        overlap_action = data.get('overlap_action', 'return')
        total_days = count_working_days(start_date, end_date)

        # Creare cerere CM auto-aprobată
        sick_leave = LeaveRequest.objects.create(
            user=employee,
            leave_type=sick_leave_type,
            start_date=start_date,
            end_date=end_date,
            total_days=total_days,
            status='approved',
            medical_document=data.get('medical_document', ''),
            overlap_action=overlap_action,
            registered_by=request.user,
            reviewed_by=request.user,
            reviewed_at=timezone.now(),
            review_note='Auto-approved sick leave registered by manager.',
        )

        # Actualizare sold CM
        balance, _ = LeaveBalance.objects.get_or_create(
            user=employee,
            leave_type=sick_leave_type,
            year=start_date.year,
            defaults={'total_days': sick_leave_type.max_days_per_year}
        )
        balance.used_days += total_days
        balance.save()

        # ── B13: Detectare și rezolvare suprapuneri ──────────────────────────
        overlapping = LeaveRequest.objects.filter(
            user=employee,
            status='approved',
            start_date__lte=end_date,
            end_date__gte=start_date,
        ).exclude(pk=sick_leave.pk).exclude(leave_type=sick_leave_type)

        overlap_results = []

        for overlap in overlapping:
            # Calculează zilele suprapuse
            overlap_start = max(overlap.start_date, start_date)
            overlap_end = min(overlap.end_date, end_date)
            overlapping_days = count_working_days(overlap_start, overlap_end)

            if overlapping_days <= 0:
                continue

            if overlap_action == 'return':
                # Returnează zilele suprapuse în sold
                overlap_balance, _ = LeaveBalance.objects.get_or_create(
                    user=employee,
                    leave_type=overlap.leave_type,
                    year=overlap.start_date.year,
                    defaults={'total_days': overlap.leave_type.max_days_per_year}
                )
                overlap_balance.used_days = max(0, overlap_balance.used_days - overlapping_days)
                overlap_balance.save()

                # Scurtează sau anulează concediul suprapus
                if overlap.start_date >= start_date and overlap.end_date <= end_date:
                    # Concediul e complet inclus în CM → anulat
                    overlap.status = 'cancelled'
                    overlap.review_note = (
                        f'Cancelled due to overlapping sick leave ({start_date} - {end_date}). '
                        f'{overlapping_days} days returned to balance.'
                    )
                    overlap.save()
                    new_end = None
                elif overlap.start_date < start_date:
                    # Concediul începe înainte de CM → trunchiază la end înainte de CM
                    from .utils import count_working_days as cwd
                    # Găsește ultima zi lucrătoare înainte de start_date CM
                    new_end = start_date - timedelta(days=1)
                    while new_end.weekday() >= 5:
                        new_end -= timedelta(days=1)
                    old_total = overlap.total_days
                    overlap.end_date = new_end
                    overlap.total_days = cwd(overlap.start_date, new_end)
                    overlap.save(update_fields=['end_date', 'total_days'])
                    new_end = overlap.end_date
                else:
                    # Concediul începe în CM → mută start_date după CM
                    new_start = end_date + timedelta(days=1)
                    while new_start.weekday() >= 5:
                        new_start += timedelta(days=1)
                    from .utils import count_working_days as cwd
                    overlap.start_date = new_start
                    overlap.total_days = cwd(new_start, overlap.end_date)
                    overlap.save(update_fields=['start_date', 'total_days'])
                    new_end = overlap.end_date

                overlap_results.append({
                    'leave_id': overlap.pk,
                    'leave_type': overlap.leave_type.name,
                    'action': 'return',
                    'days_returned': float(overlapping_days),
                    'original_period': f'{overlap_start} - {overlap_end}',
                })

            elif overlap_action == 'extend':
                # Prelungește concediul după CM
                # Calculează câte zile trebuie adăugate după end_date CM
                new_end_date = _add_working_days(end_date, int(overlapping_days))

                # Scurtează partea suprapusă din concediul existent
                if overlap.start_date >= start_date and overlap.end_date <= end_date:
                    # Complet suprapus → mută tot concediul după CM
                    from .utils import count_working_days as cwd
                    new_start = end_date + timedelta(days=1)
                    while new_start.weekday() >= 5:
                        new_start += timedelta(days=1)
                    overlap.start_date = new_start
                    overlap.end_date = new_end_date
                    overlap.total_days = cwd(new_start, new_end_date)
                    overlap.save(update_fields=['start_date', 'end_date', 'total_days'])
                elif overlap.start_date < start_date:
                    # Concediul începe înainte → trunchiază la ziua anterioară CM + adaugă zile după CM
                    from .utils import count_working_days as cwd
                    new_end_before = start_date - timedelta(days=1)
                    while new_end_before.weekday() >= 5:
                        new_end_before -= timedelta(days=1)
                    # Creează o cerere nouă pentru zilele prelungite după CM
                    new_start_after = end_date + timedelta(days=1)
                    while new_start_after.weekday() >= 5:
                        new_start_after += timedelta(days=1)
                    LeaveRequest.objects.create(
                        user=employee,
                        leave_type=overlap.leave_type,
                        start_date=new_start_after,
                        end_date=new_end_date,
                        total_days=cwd(new_start_after, new_end_date),
                        status='approved',
                        reason=f'Extension of leave #{overlap.pk} due to sick leave ({start_date} - {end_date}).',
                        reviewed_by=request.user,
                        reviewed_at=timezone.now(),
                    )
                    overlap.end_date = new_end_before
                    overlap.total_days = cwd(overlap.start_date, new_end_before)
                    overlap.save(update_fields=['end_date', 'total_days'])
                else:
                    # Concediul începe în CM → mută complet după CM
                    from .utils import count_working_days as cwd
                    new_start = end_date + timedelta(days=1)
                    while new_start.weekday() >= 5:
                        new_start += timedelta(days=1)
                    overlap.start_date = new_start
                    overlap.end_date = new_end_date
                    overlap.total_days = cwd(new_start, new_end_date)
                    overlap.save(update_fields=['start_date', 'end_date', 'total_days'])

                overlap_results.append({
                    'leave_id': overlap.pk,
                    'leave_type': overlap.leave_type.name,
                    'action': 'extend',
                    'days_shifted': float(overlapping_days),
                    'new_end_date': str(new_end_date),
                    'original_period': f'{overlap_start} - {overlap_end}',
                })

        # ── Notificare angajat ───────────────────────────────────────────────
        from attendance.models import Notification

        overlap_msg = ''
        if overlap_results:
            if overlap_action == 'return':
                overlap_msg = f' {len(overlap_results)} overlapping leave(s) adjusted — days returned to your balance.'
            else:
                overlap_msg = f' {len(overlap_results)} overlapping leave(s) extended after your sick leave.'

        Notification.objects.create(
            user=employee,
            title='Sick Leave registered',
            message=(
                f'{request.user.get_full_name()} registered a sick leave for you: '
                f'{start_date} - {end_date} ({total_days} working days).{overlap_msg}'
            ),
            type='leave'
        )

        # Notificare informativă pentru managerul direct (dacă cel care înregistrează e admin)
        if request.user.effective_role == 'admin' and employee.department:
            try:
                manager = User.objects.filter(
                    department=employee.department,
                    role='manager'
                ).exclude(pk=request.user.pk).first()
                if manager:
                    Notification.objects.create(
                        user=manager,
                        title='Sick Leave registered for team member',
                        message=(
                            f'{employee.get_full_name()} has been registered on sick leave '
                            f'from {start_date} to {end_date} ({total_days} working days).'
                        ),
                        type='leave'
                    )
            except Exception:
                pass
        elif request.user.effective_role == 'manager':
            # Notificare informativă la director/admin
            try:
                director = User.objects.filter(role__in=['director', 'admin']).first()
                if director:
                    Notification.objects.create(
                        user=director,
                        title='Sick Leave registered',
                        message=(
                            f'Manager {request.user.get_full_name()} registered sick leave for '
                            f'{employee.get_full_name()}: {start_date} - {end_date}.'
                        ),
                        type='leave'
                    )
            except Exception:
                pass

        return Response({
            'sick_leave': LeaveRequestSerializer(sick_leave).data,
            'overlaps_resolved': overlap_results,
            'message': f'Sick leave registered successfully. {len(overlap_results)} overlap(s) resolved.',
        }, status=status.HTTP_201_CREATED)