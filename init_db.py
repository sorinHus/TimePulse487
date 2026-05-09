import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'timepulse487.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

username = os.environ.get('DJANGO_SUPERUSER_USERNAME', 'sorin487')
email = os.environ.get('DJANGO_SUPERUSER_EMAIL', 'sorin@timepulse.app')
password = os.environ.get('DJANGO_SUPERUSER_PASSWORD', '')

if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username=username, email=email, password=password)
    print(f'Superuser {username} created with password.')
else:
    user = User.objects.get(username=username)
    user.set_password(password)
    user.save()
    print(f'Password reset for {username}.')