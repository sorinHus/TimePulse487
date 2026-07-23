from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.contrib.auth import get_user_model
from datetime import date, timedelta
from decimal import Decimal
from .models import LeaveType, LeaveBalance, LeaveRequest, LeaveSchedule, SeniorityRule
from .serializers import (
    LeaveTypeSerializer, LeaveBalanceSerializer,
    LeaveRequestSerializer, SickLeaveRegisterSerializer,
    LeaveScheduleSerializer,
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
                    type='system',
                    code='substitute_assigned',
                    params={
                        'substituted_name': leave.user.get_full_name(),
                        'role': leave.user.effective_role,
                        'start_date': str(leave.start_date),
                        'end_date': str(leave.end_date),
                    },
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
            type='leave',
            code='sick_leave_registered',
            params={
                'context': (f'overlap_{overlap_action}' if overlap_results else ''),
                'actor_name': request.user.get_full_name(),
                'start_date': str(start_date),
                'end_date': str(end_date),
                'total_days': total_days,
                'overlap_count': len(overlap_results),
            },
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
                        type='leave',
                        code='sick_leave_registered_team',
                        params={
                            'employee_name': employee.get_full_name(),
                            'start_date': str(start_date),
                            'end_date': str(end_date),
                            'total_days': total_days,
                        },
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
                        type='leave',
                        code='sick_leave_registered_director',
                        params={
                            'manager_name': request.user.get_full_name(),
                            'employee_name': employee.get_full_name(),
                            'start_date': str(start_date),
                            'end_date': str(end_date),
                        },
                    )
            except Exception:
                pass

        return Response({
            'sick_leave': LeaveRequestSerializer(sick_leave).data,
            'overlaps_resolved': overlap_results,
            'message': f'Sick leave registered successfully. {len(overlap_results)} overlap(s) resolved.',
        }, status=status.HTTP_201_CREATED)

# ── B17: Annual Leave Schedule ───────────────────────────────────────────────

def get_annual_leave_days_for_year(user, year):
    """Annual leave entitlement for a year — seniority calculated as of Dec 31 of that year."""
    try:
        annual_leave_type = LeaveType.objects.get(name='Annual Leave', is_active=True)
        base = annual_leave_type.max_days_per_year
    except LeaveType.DoesNotExist:
        base = 21
    extra = 0
    if user.hire_date:
        dec31 = date(year, 12, 31)
        years_worked = (dec31 - user.hire_date).days // 365
        rules = SeniorityRule.objects.filter(min_years__lte=years_worked).order_by('-min_years')
        if rules.exists():
            extra = rules.first().extra_days
    return base + extra


def _schedule_empty(user, year):
    from .serializers import _carryover_data
    carryover, carryover_exp = _carryover_data(user, year)
    return {
        'id': None,
        'user': user.pk,
        'username': user.username,
        'full_name': user.get_full_name() or user.username,
        'year': year,
        'status': None,
        'monthly_plan': {},
        'total_planned_days': 0,
        'annual_leave_days': get_annual_leave_days_for_year(user, year),
        'carryover_days': carryover,
        'carryover_expires_at': carryover_exp,
        'review_note': '',
        'reviewed_by': None,
        'reviewed_by_name': None,
        'reviewed_at': None,
        'created_at': None,
        'updated_at': None,
    }


class LeaveScheduleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        year = int(request.query_params.get('year', timezone.now().year))
        try:
            schedule = LeaveSchedule.objects.get(user=request.user, year=year)
            return Response(LeaveScheduleSerializer(schedule).data)
        except LeaveSchedule.DoesNotExist:
            return Response(_schedule_empty(request.user, year))

    def put(self, request):
        year = int(request.query_params.get('year', timezone.now().year))
        monthly_plan = request.data.get('monthly_plan', {})

        total = sum(float(v) for v in monthly_plan.values() if v)
        max_days = get_annual_leave_days_for_year(request.user, year)
        if total > max_days:
            return Response(
                {'detail': f'Total planned days ({total:.0f}) exceeds your entitlement ({max_days} days).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        schedule, created = LeaveSchedule.objects.get_or_create(
            user=request.user, year=year,
            defaults={'monthly_plan': monthly_plan, 'total_planned_days': Decimal(str(round(total, 1)))}
        )
        if not created:
            if schedule.status == 'approved':
                return Response({'detail': 'Approved schedules cannot be edited.'}, status=status.HTTP_400_BAD_REQUEST)
            schedule.monthly_plan = monthly_plan
            schedule.total_planned_days = Decimal(str(round(total, 1)))
            schedule.status = 'draft'
            schedule.save(update_fields=['monthly_plan', 'total_planned_days', 'status', 'updated_at'])

        return Response(LeaveScheduleSerializer(schedule).data)


class LeaveScheduleSubmitView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            schedule = LeaveSchedule.objects.get(pk=pk, user=request.user)
        except LeaveSchedule.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        if schedule.status not in ['draft', 'rejected']:
            return Response({'detail': 'Only draft or rejected schedules can be submitted.'}, status=status.HTTP_400_BAD_REQUEST)
        if not schedule.monthly_plan or schedule.total_planned_days <= 0:
            return Response({'detail': 'Plan is empty. Add at least one month before submitting.'}, status=status.HTTP_400_BAD_REQUEST)

        schedule.status = 'submitted'
        schedule.save(update_fields=['status', 'updated_at'])

        from attendance.models import Notification
        from django.contrib.auth import get_user_model
        User = get_user_model()
        managers = User.objects.filter(
            role__in=['manager', 'admin', 'director']
        )
        if request.user.department:
            managers = managers.filter(department=request.user.department) | User.objects.filter(role='admin')
        for mgr in managers.distinct():
            Notification.objects.create(
                user=mgr,
                title='Annual leave schedule submitted',
                message=f'{request.user.get_full_name()} submitted their annual leave plan for {schedule.year}.',
                type='leave',
                code='leave_schedule_submitted',
                params={
                    'actor_name': request.user.get_full_name(),
                    'year': schedule.year,
                },
            )

        return Response(LeaveScheduleSerializer(schedule).data)


class LeaveScheduleReviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if request.user.effective_role not in ['admin', 'manager', 'director']:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            schedule = LeaveSchedule.objects.get(pk=pk)
        except LeaveSchedule.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action')
        if action not in ['approve', 'reject']:
            return Response({'detail': 'Action must be approve or reject.'}, status=status.HTTP_400_BAD_REQUEST)

        review_note = request.data.get('review_note', '').strip()
        if action == 'reject' and not review_note:
            return Response({'detail': 'A reason is required for rejection.'}, status=status.HTTP_400_BAD_REQUEST)

        schedule.status = 'approved' if action == 'approve' else 'rejected'
        schedule.reviewed_by = request.user
        schedule.reviewed_at = timezone.now()
        schedule.review_note = review_note
        schedule.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_note', 'updated_at'])

        from attendance.models import Notification
        Notification.objects.create(
            user=schedule.user,
            title=f'Annual leave schedule {schedule.status}',
            message=(
                f'Your annual leave plan for {schedule.year} has been {schedule.status} '
                f'by {request.user.get_full_name()}.'
                + (f' Note: {review_note}' if review_note else '')
            ),
            type='leave',
            code='leave_schedule_reviewed',
            params={
                'context': schedule.status + ('_note' if review_note else ''),
                'year': schedule.year,
                'actor_name': request.user.get_full_name(),
                'note': review_note,
            },
        )

        return Response(LeaveScheduleSerializer(schedule).data)


class LeaveScheduleTeamView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.effective_role not in ['admin', 'manager', 'director']:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        year = int(request.query_params.get('year', timezone.now().year))
        user_id = request.query_params.get('user_id')

        from django.contrib.auth import get_user_model
        User = get_user_model()

        if user_id:
            try:
                target = User.objects.get(pk=user_id)
            except User.DoesNotExist:
                return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
            try:
                schedule = LeaveSchedule.objects.get(user=target, year=year)
                return Response(LeaveScheduleSerializer(schedule).data)
            except LeaveSchedule.DoesNotExist:
                return Response(_schedule_empty(target, year))

        if request.user.effective_role == 'manager':
            schedules = LeaveSchedule.objects.filter(
                user__department=request.user.department, year=year
            ).select_related('user', 'reviewed_by')
        else:
            schedules = LeaveSchedule.objects.filter(year=year).select_related('user', 'reviewed_by')

        return Response(LeaveScheduleSerializer(schedules, many=True).data)


# ── B12: Seniority Rules ─────────────────────────────────────────────────────

def get_seniority_extra_days(user):
    """Calculează zilele extra de concediu pe baza vechimii userului."""
    from .models import SeniorityRule
    if not user.hire_date:
        return 0
    today = date.today()
    years = (today - user.hire_date).days // 365
    rules = SeniorityRule.objects.filter(min_years__lte=years).order_by('-min_years')
    if rules.exists():
        return rules.first().extra_days
    return 0


class SeniorityRuleListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .models import SeniorityRule
        from .serializers import SeniorityRuleSerializer
        rules = SeniorityRule.objects.all()
        return Response(SeniorityRuleSerializer(rules, many=True).data)

    def post(self, request):
        if request.user.effective_role != 'admin':
            return Response({'detail': 'Admin only.'}, status=status.HTTP_403_FORBIDDEN)
        from .serializers import SeniorityRuleSerializer
        serializer = SeniorityRuleSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SeniorityRuleDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        if request.user.effective_role != 'admin':
            return Response({'detail': 'Admin only.'}, status=status.HTTP_403_FORBIDDEN)
        from .models import SeniorityRule
        try:
            rule = SeniorityRule.objects.get(pk=pk)
            rule.delete()
            return Response({'detail': 'Deleted.'})
        except SeniorityRule.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, pk):
        if request.user.effective_role != 'admin':
            return Response({'detail': 'Admin only.'}, status=status.HTTP_403_FORBIDDEN)
        from .models import SeniorityRule
        from .serializers import SeniorityRuleSerializer
        try:
            rule = SeniorityRule.objects.get(pk=pk)
            serializer = SeniorityRuleSerializer(rule, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except SeniorityRule.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)


class ApplySeniorityToBalancesView(APIView):
    """
    POST /api/leaves/seniority-rules/apply/
    Recalculează total_days pentru Annual Leave pentru toți userii activi,
    aplicând regulile de vechime peste valoarea de bază din LeaveType.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.effective_role != 'admin':
            return Response({'detail': 'Admin only.'}, status=status.HTTP_403_FORBIDDEN)

        from django.contrib.auth import get_user_model
        User = get_user_model()
        from .models import SeniorityRule

        try:
            annual_leave_type = LeaveType.objects.get(name='Annual Leave', is_active=True)
        except LeaveType.DoesNotExist:
            return Response({'detail': 'Annual Leave type not found.'}, status=status.HTTP_400_BAD_REQUEST)

        current_year = timezone.now().year
        users = User.objects.filter(is_active=True)
        updated = 0

        for u in users:
            extra = get_seniority_extra_days(u)
            new_total = annual_leave_type.max_days_per_year + extra
            balance, created = LeaveBalance.objects.get_or_create(
                user=u,
                leave_type=annual_leave_type,
                year=current_year,
                defaults={'total_days': new_total}
            )
            if not created and balance.total_days != new_total:
                balance.total_days = new_total
                balance.save(update_fields=['total_days'])
                updated += 1
            elif created:
                updated += 1

        return Response({
            'detail': f'Seniority applied. {updated} balances updated.',
            'year': current_year,
            'base_days': annual_leave_type.max_days_per_year,
        })        