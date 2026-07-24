from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta, datetime
from decimal import Decimal
from attendance.models import AttendanceSession

MAX_HOURS = Decimal('8.50')


class Command(BaseCommand):
    help = 'Auto clock-out open sessions at scheduled end time (or max 8h30m fallback)'

    def handle(self, *args, **options):
        now = timezone.now()
        open_sessions = AttendanceSession.objects.filter(
            status='open'
        ).select_related('user__schedule_type', 'user__department__schedule_type')
        count = 0

        for session in open_sessions:
            session.clock_out = min(now, self._scheduled_cutoff(session))
            session.save()
            session.calculate_hours()
            count += 1
            self.stdout.write(f'Closed session {session.id} for {session.user.username}')

        self.stdout.write(self.style.SUCCESS(f'Auto clock-out complete: {count} sessions closed.'))

    def _scheduled_cutoff(self, session):
        fallback = session.clock_in + timedelta(hours=8, minutes=30)

        schedule = session.user.effective_schedule_type
        if not schedule:
            return fallback

        local_clock_in = timezone.localtime(session.clock_in)
        naive_end = datetime.combine(local_clock_in.date(), schedule.end_time)
        if schedule.crosses_midnight:
            naive_end += timedelta(days=1)

        cutoff = timezone.make_aware(naive_end, local_clock_in.tzinfo)
        if cutoff <= session.clock_in:
            # Program greșit configurat sau clock-in foarte târziu — nu producem
            # o sesiune negativă/zero, cădem pe fallback-ul fix.
            return fallback
        return cutoff
