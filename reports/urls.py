from django.urls import path
from .views import TeamCalendarView, AttendanceExportView, LeaveExportView

urlpatterns = [
    path('calendar/', TeamCalendarView.as_view(), name='team_calendar'),
    path('reports/attendance/export/', AttendanceExportView.as_view(), name='attendance_export'),
    path('reports/leaves/export/', LeaveExportView.as_view(), name='leave_export'),
]