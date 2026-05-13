from django.urls import path
from .views import (
    CheckInView, CheckOutView, TodayAttendanceView,
    AttendanceHistoryView, TeamAttendanceView,
    ClockInView, ClockOutView, TodaySessionsView,
    SessionHistoryView, TeamSessionsView,
    OvertimeRequestView, OvertimeRequestListView, OvertimeReviewView,
    NotificationListView, NotificationMarkReadView,
    NotificationMarkAllReadView, UnreadNotificationCountView,
    BulkClockInView, BulkClockOutView,
)

urlpatterns = [
    # Legacy
    path('attendance/check-in/', CheckInView.as_view(), name='check_in'),
    path('attendance/check-out/', CheckOutView.as_view(), name='check_out'),
    path('attendance/today/', TodayAttendanceView.as_view(), name='today_attendance'),
    path('attendance/history/', AttendanceHistoryView.as_view(), name='attendance_history'),
    path('attendance/team/', TeamAttendanceView.as_view(), name='team_attendance'),

    # Sesiuni multiple
    path('attendance/clock-in/', ClockInView.as_view(), name='clock_in'),
    path('attendance/clock-out/', ClockOutView.as_view(), name='clock_out'),
    path('attendance/today-sessions/', TodaySessionsView.as_view(), name='today_sessions'),
    path('attendance/session-history/', SessionHistoryView.as_view(), name='session_history'),
    path('attendance/team-sessions/', TeamSessionsView.as_view(), name='team_sessions'),

    # Overtime
    path('attendance/overtime/', OvertimeRequestView.as_view(), name='overtime_request'),
    path('attendance/overtime/list/', OvertimeRequestListView.as_view(), name='overtime_list'),
    path('attendance/overtime/<int:pk>/review/', OvertimeReviewView.as_view(), name='overtime_review'),

    # Admin bulk actions
    path('attendance/admin/bulk-clock-in/', BulkClockInView.as_view(), name='bulk_clock_in'),
    path('attendance/admin/bulk-clock-out/', BulkClockOutView.as_view(), name='bulk_clock_out'),

    # Notificări
    path('notifications/', NotificationListView.as_view(), name='notifications'),
    path('notifications/<int:pk>/', NotificationMarkReadView.as_view(), name='notification_detail'),
    path('notifications/mark-all-read/', NotificationMarkAllReadView.as_view(), name='notifications_mark_all'),
    path('notifications/unread-count/', UnreadNotificationCountView.as_view(), name='notifications_unread_count'),
]