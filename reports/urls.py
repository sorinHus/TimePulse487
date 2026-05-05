from django.urls import path
from .views import TeamCalendarView

urlpatterns = [
    path('calendar/', TeamCalendarView.as_view(), name='team_calendar'),
]