from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from attendance.models import AttendanceSession

MAX_HOURS = Decimal('8.50')


class Command(BaseCommand):
    help = 'Auto clock-out open sessions at midnight (max 8h30m)'

    def handle(self, *args, **options):
        now = timezone.now()
        open_sessions = AttendanceSession.objects.filter(status='open')
        count = 0

        for session in open_sessions:
            max_clockout = session.clock_in + timedelta(hours=8, minutes=30)
            session.clock_out = min(now, max_clockout)
            session.save()
            session.calculate_hours()
            count += 1
            self.stdout.write(f'Closed session {session.id} for {session.user.username}')

        self.stdout.write(self.style.SUCCESS(f'Auto clock-out complete: {count} sessions closed.'))