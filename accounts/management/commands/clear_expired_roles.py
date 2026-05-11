from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Clear expired temporary roles'

    def handle(self, *args, **options):
        today = timezone.localdate()
        expired = User.objects.filter(
            temporary_role__isnull=False,
            temporary_role_end__lt=today
        )
        count = expired.count()
        for user in expired:
            self.stdout.write(
                f'Clearing temporary role for {user.username} '
                f'(was substituting {user.substituting_for})'
            )
            user.temporary_role = None
            user.temporary_role_start = None
            user.temporary_role_end = None
            user.substituting_for = None
            user.save(update_fields=[
                'temporary_role', 'temporary_role_start',
                'temporary_role_end', 'substituting_for'
            ])

        self.stdout.write(
            self.style.SUCCESS(f'Cleared {count} expired temporary roles.')
        )