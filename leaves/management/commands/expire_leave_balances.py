from datetime import date
from django.core.management.base import BaseCommand
from leaves.models import LeaveBalance, LeaveType


class Command(BaseCommand):
    help = 'Expire unused Annual Leave days older than 18 months (after July 1 of year+2).'

    def handle(self, *args, **options):
        today = date.today()

        try:
            annual_leave = LeaveType.objects.get(name='Annual Leave', is_active=True)
        except LeaveType.DoesNotExist:
            self.stdout.write('Annual Leave type not found. Aborting.')
            return

        expired_count = 0
        users_notified = 0

        balances = LeaveBalance.objects.filter(
            leave_type=annual_leave
        ).select_related('user', 'leave_type')

        for balance in balances:
            expiry_date = date(balance.year + 2, 7, 1)
            if today < expiry_date:
                continue

            remaining = balance.total_days - balance.used_days - balance.expired_days
            if remaining <= 0:
                continue

            balance.expired_days += remaining
            balance.save(update_fields=['expired_days'])
            expired_count += 1

            try:
                from attendance.models import Notification
                Notification.objects.create(
                    user=balance.user,
                    title='Annual Leave days expired',
                    message=(
                        f'{float(remaining):.0f} unused Annual Leave day(s) from {balance.year} '
                        f'have expired as of {expiry_date}. '
                        f'Unused leave must be taken within 18 months of the year end.'
                    ),
                    type='leave'
                )
                users_notified += 1
            except Exception:
                pass

        self.stdout.write(
            self.style.SUCCESS(
                f'Done. {expired_count} balance(s) expired, {users_notified} user(s) notified.'
            )
        )
