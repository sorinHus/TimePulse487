from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.db.models import Sum
from decimal import Decimal
from .models import Attendance, AttendanceSession
from .serializers import (
    AttendanceSerializer, CheckInSerializer, CheckOutSerializer,
    AttendanceSessionSerializer, DaySummarySerializer,
    ClockInSerializer, ClockOutSerializer
)

WORKDAY_HOURS = Decimal('8.50')


def build_day_summary(date, sessions):
    total_hours = sessions.aggregate(s=Sum('work_hours'))['s'] or Decimal('0')
    total_night = sessions.aggregate(s=Sum('night_hours'))['s'] or Decimal('0')
    complete = sessions.filter(status='complete').count()
    open_s = sessions.filter(status='open').count()
    remaining = max(WORKDAY_HOURS - total_hours, Decimal('0'))
    overtime = max(total_hours - WORKDAY_HOURS, Decimal('0'))

    if total_hours >= WORKDAY_HOURS:
        day_status = 'complete'
    elif total_hours > 0:
        day_status = 'in_progress'
    else:
        day_status = 'absent'

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
    }


# --- Legacy views (check-in/check-out) ---

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
        if user.role in ['admin', 'manager']:
            if user.role == 'manager':
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

        open_session = AttendanceSession.objects.filter(
            user=request.user, status='open'
        ).first()
        if open_session:
            return Response(
                {'detail': 'You already have an open session. Please clock out first.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        now = timezone.now()
        session = AttendanceSession.objects.create(
            user=request.user,
            date=timezone.localdate(),
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

        open_session = AttendanceSession.objects.filter(
            user=request.user, status='open'
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
        summary = build_day_summary(today, sessions)
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
            result.append(build_day_summary(date, day_sessions))

        return Response(DaySummarySerializer(result, many=True).data)


class TeamSessionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role not in ['admin', 'manager', 'director']:
            return Response(status=status.HTTP_403_FORBIDDEN)

        today = timezone.localdate()
        date_param = request.query_params.get('date', str(today))

        if user.role == 'manager':
            team_ids = user.subordinates.values_list('id', flat=True)
            sessions = AttendanceSession.objects.filter(
                user_id__in=team_ids, date=date_param
            )
        else:
            sessions = AttendanceSession.objects.filter(date=date_param)

        return Response(AttendanceSessionSerializer(sessions, many=True).data)