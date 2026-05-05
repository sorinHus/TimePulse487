from django.urls import path
from .views import CheckInView, CheckOutView, TodayAttendanceView, AttendanceHistoryView, TeamAttendanceView

urlpatterns = [
    path('attendance/check-in/', CheckInView.as_view(), name='check_in'),
    path('attendance/check-out/', CheckOutView.as_view(), name='check_out'),
    path('attendance/today/', TodayAttendanceView.as_view(), name='today_attendance'),
    path('attendance/history/', AttendanceHistoryView.as_view(), name='attendance_history'),
    path('attendance/team/', TeamAttendanceView.as_view(), name='team_attendance'),
]