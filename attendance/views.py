from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.db.models import Sum
from decimal import Decimal
from .models import Attendance, AttendanceSession, OvertimeRequest, Notification
from .serializers import (
    AttendanceSerializer, CheckInSerializer, CheckOutSerializer,
    AttendanceSessionSerializer, DaySummarySerializer,
    ClockInSerializer, ClockOutSerializer,
    OvertimeRequestSerializer, OvertimeReviewSerializer,
    NotificationSerializer
)

WORKDAY_HOURS = Decimal('8.50')


def create_notification(user, title, message, notif_type='system'):
    Notification.objects.create(
        user=user,
        title=title,
        message=message,
        type=notif_type
    )


def build_day_summary(date, sessions, user=None):
    total_hours = sessions.aggregate(s=Sum('work_hours'))['s'] or Decimal('0')
    total_night = sessions.aggregate(s=Sum('night_hours'))['s'] or Decimal('0')
    complete = sessions.filter(status='complete').count()
    open_s = sessions.filter(status='open').count()
    remaining = max(WORKDAY_HOURS - total_hours, Decimal('0'))
    overtime = max(total_hours - WORKDAY_HOURS, Decimal('0'))

    if total_hours >= WORKDAY_HOURS:
        day_status = 'complete'
    elif open_s > 0:
        day_status = 'in_progress'
    elif total_hours > 0:
        day_status = 'incomplete'
    else:
        day_status = 'absent'

    overtime_request = None
    if user:
        ot_req = OvertimeRequest.objects.filter(user=user, date=date).first()
        if ot_req:
            overtime_request = {
                'id': ot_req.id,
                'status': ot_req.status,
                'requested_hours': str(ot_req.requested_hours),
                'approved_hours': str(ot_req.approved_hours) if ot_req.approved_hours else None,
            }

    return {
        'date': date,
        'day_of_week': date.strftime('%a'),
        'sessions': sessions.order_by('clock_in'),
        'total_hours': round(total_hours, 2),
        'total_night_hours': round(total_night, 2),
        'complete_sessions': complete,
        'open_sessions': open_s,
        'has_open_session': open_s > 0,
        'status': day_status,
        'remaining_hours': round(remaining, 2),
        'overtime_hours': round(overtime, 2),
        'overtime_request': overtime_request,
    }


# --- Legacy views ---

class CheckInView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        today = timezone.localdate()
        existing = Attendance.objects.filter(user=request.user, date=today).first()
        if existing and existing.check_in:
            return Response(
                {'detail': 'You have already checked in today.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        serializer = CheckInSerializer(data=request.data)
        if serializer.is_valid():
            attendance, created = Attendance.objects.get_or_create(
                user=request.user,
                date=today,
                defaults={'notes': serializer.validated_data.get('notes', '')}
            )
            attendance.check_in = timezone.localtime().time()
            attendance.status = 'present'
            attendance.save()
            return Response(AttendanceSerializer(attendance).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CheckOutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        today = timezone.localdate()
        attendance = Attendance.objects.filter(user=request.user, date=today).first()
        if not attendance or not attendance.check_in:
            return Response(
                {'detail': 'You have not checked in today.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if attendance.check_out:
            return Response(
                {'detail': 'You have already checked out today.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        serializer = CheckOutSerializer(data=request.data)
        if serializer.is_valid():
            attendance.check_out = timezone.localtime().time()
            if serializer.validated_data.get('notes'):
                attendance.notes = serializer.validated_data['notes']
            attendance.save()
            attendance.calculate_work_hours()
            return Response(AttendanceSerializer(attendance).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TodayAttendanceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        attendance = Attendance.objects.filter(user=request.user, date=today).first()
        if attendance:
            return Response(AttendanceSerializer(attendance).data)
        return Response({'detail': 'No attendance record for today.'}, status=status.HTTP_404_NOT_FOUND)


class AttendanceHistoryView(generics.ListAPIView):
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Attendance.objects.filter(user=user)
        month_param = self.request.query_params.get('month')
        if month_param:
            try:
                year, month = month_param.split('-')
                queryset = queryset.filter(date__year=int(year), date__month=int(month))
            except (ValueError, AttributeError):
                pass
        return queryset.order_by('date')


class TeamAttendanceView(generics.ListAPIView):
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        today = timezone.localdate()
        date = self.request.query_params.get('date', today)
        if user.effective_role in ['admin', 'manager']:
            if user.effective_role == 'manager':
                team_ids = user.subordinates.values_list('id', flat=True)
                return Attendance.objects.filter(user_id__in=team_ids, date=date)
            return Attendance.objects.filter(date=date)
        return Attendance.objects.none()


# --- New views (clock-in/clock-out cu sesiuni multiple) ---

class ClockInView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ClockInSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.localdate()
        open_session = AttendanceSession.objects.filter(
            user=request.user, status='open', date=today
        ).first()
        if open_session:
            return Response(
                {'detail': 'You already have an open session. Please clock out first.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        now = timezone.now()
        session = AttendanceSession.objects.create(
            user=request.user,
            date=today,
            clock_in=now,
            notes=serializer.validated_data.get('notes', '')
        )
        return Response(AttendanceSessionSerializer(session).data, status=status.HTTP_201_CREATED)


class ClockOutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ClockOutSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.localdate()
        open_session = AttendanceSession.objects.filter(
            user=request.user, status='open', date=today
        ).first()
        if not open_session:
            return Response(
                {'detail': 'No open session found. Please clock in first.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if serializer.validated_data.get('notes'):
            open_session.notes = serializer.validated_data['notes']

        open_session.clock_out = timezone.now()
        open_session.save()
        open_session.calculate_hours()
        return Response(AttendanceSessionSerializer(open_session).data, status=status.HTTP_200_OK)


class TodaySessionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        sessions = AttendanceSession.objects.filter(user=request.user, date=today)
        summary = build_day_summary(today, sessions, user=request.user)
        return Response(DaySummarySerializer(summary).data)


class SessionHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        month_param = request.query_params.get('month')
        sessions_qs = AttendanceSession.objects.filter(user=request.user)

        if month_param:
            try:
                year, month = month_param.split('-')
                sessions_qs = sessions_qs.filter(
                    date__year=int(year), date__month=int(month)
                )
            except (ValueError, AttributeError):
                pass

        dates = sessions_qs.values_list('date', flat=True).distinct().order_by('date')
        result = []
        for date in dates:
            day_sessions = sessions_qs.filter(date=date)
            result.append(build_day_summary(date, day_sessions, user=request.user))

        return Response(DaySummarySerializer(result, many=True).data)


class TeamSessionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.effective_role not in ['admin', 'manager', 'director']:
            return Response(status=status.HTTP_403_FORBIDDEN)

        today = timezone.localdate()
        date_param = request.query_params.get('date', str(today))

        if user.effective_role == 'manager':
            team_ids = user.subordinates.values_list('id', flat=True)
            sessions = AttendanceSession.objects.filter(
                user_id__in=team_ids, date=date_param
            )
        else:
            sessions = AttendanceSession.objects.filter(date=date_param)

        return Response(AttendanceSessionSerializer(sessions, many=True).data)


# --- Overtime views ---

class OvertimeRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        date_str = request.data.get('date')
        if not date_str:
            return Response({'detail': 'Date is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from datetime import date as date_type
            req_date = date_type.fromisoformat(date_str)
        except ValueError:
            return Response({'detail': 'Invalid date format.'}, status=status.HTTP_400_BAD_REQUEST)

        sessions = AttendanceSession.objects.filter(
            user=request.user, date=req_date, status='complete'
        )
        total_hours = sessions.aggregate(s=Sum('work_hours'))['s'] or Decimal('0')
        overtime = total_hours - WORKDAY_HOURS

        if overtime <= 0:
            return Response(
                {'detail': 'No overtime hours for this day.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if OvertimeRequest.objects.filter(user=request.user, date=req_date).exists():
            return Response(
                {'detail': 'Overtime request already submitted for this day.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        ot_request = OvertimeRequest.objects.create(
            user=request.user,
            date=req_date,
            requested_hours=round(overtime, 2)
        )

        # Notificare manager
        manager = getattr(request.user, 'manager', None)
        if manager:
            create_notification(
                manager,
                'New overtime request',
                f'{request.user.get_full_name()} requested {round(overtime, 2)}h overtime for {req_date}.',
                'overtime'
            )

        return Response(OvertimeRequestSerializer(ot_request).data, status=status.HTTP_201_CREATED)


class OvertimeRequestListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.effective_role in ['admin', 'director']:
            requests = OvertimeRequest.objects.all()
        elif user.effective_role == 'manager':
            team_ids = user.subordinates.values_list('id', flat=True)
            requests = OvertimeRequest.objects.filter(user_id__in=team_ids)
        else:
            requests = OvertimeRequest.objects.filter(user=user)

        status_filter = request.query_params.get('status')
        if status_filter:
            requests = requests.filter(status=status_filter)

        month_param = request.query_params.get('month')
        if month_param:
            try:
                year, month = month_param.split('-')
                requests = requests.filter(date__year=int(year), date__month=int(month))
            except (ValueError, AttributeError):
                pass

        return Response(OvertimeRequestSerializer(requests, many=True).data)


class OvertimeReviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        if user.effective_role not in ['admin', 'manager', 'director']:
            return Response(status=status.HTTP_403_FORBIDDEN)

        try:
            ot_request = OvertimeRequest.objects.get(pk=pk)
        except OvertimeRequest.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        # Director auto-aprobă pentru el însuși; manager aprobă pentru echipa lui
        if user.effective_role == 'manager':
            team_ids = user.subordinates.values_list('id', flat=True)
            if ot_request.user_id not in team_ids:
                return Response(status=status.HTTP_403_FORBIDDEN)

        serializer = OvertimeReviewSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        action = serializer.validated_data['action']
        approved_hours = serializer.validated_data.get('approved_hours')
        manager_note = serializer.validated_data.get('manager_note', '')

        if action == 'approve':
            ot_request.status = 'approved'
            ot_request.approved_hours = ot_request.requested_hours
        elif action == 'partially_approve':
            if approved_hours > ot_request.requested_hours:
                return Response(
                    {'detail': 'Approved hours cannot exceed requested hours.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            ot_request.status = 'partially_approved'
            ot_request.approved_hours = approved_hours
        elif action == 'reject':
            ot_request.status = 'rejected'
            ot_request.approved_hours = Decimal('0')

        ot_request.manager_note = manager_note
        ot_request.reviewed_by = user
        ot_request.reviewed_at = timezone.now()
        ot_request.save()

        # Notificare angajat
        if action == 'approve':
            msg = f'Your overtime request for {ot_request.date} has been approved ({ot_request.approved_hours}h).'
        elif action == 'partially_approve':
            msg = f'Your overtime request for {ot_request.date} has been partially approved ({ot_request.approved_hours}h out of {ot_request.requested_hours}h requested).'
        else:
            msg = f'Your overtime request for {ot_request.date} has been rejected.'
            if manager_note:
                msg += f' Note: {manager_note}'

        create_notification(ot_request.user, 'Overtime request reviewed', msg, 'overtime')

        return Response(OvertimeRequestSerializer(ot_request).data)


# --- Notification views ---

class NotificationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(user=request.user)
        unread_only = request.query_params.get('unread')
        if unread_only:
            notifications = notifications.filter(is_read=False)
        return Response(NotificationSerializer(notifications, many=True).data)


class NotificationMarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            notif = Notification.objects.get(pk=pk, user=request.user)
            notif.is_read = True
            notif.save()
            return Response({'detail': 'Marked as read.'})
        except Notification.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, pk):
        try:
            notif = Notification.objects.get(pk=pk, user=request.user)
            notif.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Notification.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)


class NotificationMarkAllReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'detail': 'All notifications marked as read.'})


class UnreadNotificationCountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({'count': count})