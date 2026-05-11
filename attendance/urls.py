from django.urls import path
from .views import (
    CheckInView, CheckOutView, TodayAttendanceView,
    AttendanceHistoryView, TeamAttendanceView,
    ClockInView, ClockOutView, TodaySessionsView,
    SessionHistoryView, TeamSessionsView,
)

urlpatterns = [
    # Legacy endpoints (păstrate pentru compatibilitate)
    path('attendance/check-in/', CheckInView.as_view(), name='check_in'),
    path('attendance/check-out/', CheckOutView.as_view(), name='check_out'),
    path('attendance/today/', TodayAttendanceView.as_view(), name='today_attendance'),
    path('attendance/history/', AttendanceHistoryView.as_view(), name='attendance_history'),
    path('attendance/team/', TeamAttendanceView.as_view(), name='team_attendance'),

    # Noi endpoints cu sesiuni multiple
    path('attendance/clock-in/', ClockInView.as_view(), name='clock_in'),
    path('attendance/clock-out/', ClockOutView.as_view(), name='clock_out'),
    path('attendance/today-sessions/', TodaySessionsView.as_view(), name='today_sessions'),
    path('attendance/session-history/', SessionHistoryView.as_view(), name='session_history'),
    path('attendance/team-sessions/', TeamSessionsView.as_view(), name='team_sessions'),
]