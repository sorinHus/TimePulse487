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
from .pontaj_views import (
    PontajSheetView,
    PontajPersonalSheetView,
    PontajSheetSaveView,
    PontajSheetRegenerateView,
    PontajSheetSubmitView,
    PontajSheetReviewView,
)

urlpatterns = [
    path('calendar/', TeamCalendarView.as_view(), name='team_calendar'),
    path('reports/attendance/export/', AttendanceExportView.as_view(), name='attendance_export'),
    path('reports/leaves/export/', LeaveExportView.as_view(), name='leave_export'),
    path('reports/pontaj/export/', PontajExportView.as_view(), name='pontaj_export'),
    path('reports/pontaj/sheet/', PontajSheetView.as_view(), name='pontaj_sheet'),
    path('reports/pontaj/personal-sheet/', PontajPersonalSheetView.as_view(), name='pontaj_personal_sheet'),
    path('reports/pontaj/sheet/<int:pk>/save/', PontajSheetSaveView.as_view(), name='pontaj_sheet_save'),
    path('reports/pontaj/sheet/<int:pk>/regenerate/', PontajSheetRegenerateView.as_view(), name='pontaj_sheet_regenerate'),
    path('reports/pontaj/sheet/<int:pk>/submit/', PontajSheetSubmitView.as_view(), name='pontaj_sheet_submit'),
    path('reports/pontaj/sheet/<int:pk>/review/', PontajSheetReviewView.as_view(), name='pontaj_sheet_review'),
    path('dashboard/admin/', AdminDashboardView.as_view(), name='admin_dashboard'),
    path('dashboard/manager/', ManagerDashboardView.as_view(), name='manager_dashboard'),
    path('dashboard/employee/', EmployeeDashboardView.as_view(), name='employee_dashboard'),
    path('debug/team/', DebugTeamView.as_view()),
]
