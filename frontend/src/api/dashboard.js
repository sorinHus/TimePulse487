from django.urls import path
from .views import (
    TeamCalendarView,
    AttendanceExportView,
    LeaveExportView,
    AdminDashboardView,
    ManagerDashboardView,
    EmployeeDashboardView,
    DebugTeamView,
    PontajExportView,
)

urlpatterns = [
    path('calendar/', TeamCalendarView.as_view(), name='team_calendar'),
    path('reports/attendance/export/', AttendanceExportView.as_view(), name='attendance_export'),
    path('reports/leaves/export/', LeaveExportView.as_view(), name='leave_export'),
    path('reports/pontaj/export/', PontajExportView.as_view(), name='pontaj_export'),
    path('dashboard/admin/', AdminDashboardView.as_view(), name='admin_dashboard'),
    path('dashboard/manager/', ManagerDashboardView.as_view(), name='manager_dashboard'),
    path('dashboard/employee/', EmployeeDashboardView.as_view(), name='employee_dashboard'),
    path('debug/team/', DebugTeamView.as_view()),
]