from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class Department(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    schedule_type = models.ForeignKey(
        'attendance.ScheduleType',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='departments'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Departament'
        verbose_name_plural = 'Departamente'

    def __str__(self):
        return self.name


class User(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Administrator'),
        ('director', 'Director'),
        ('manager', 'Manager'),
        ('employee', 'Angajat'),
    ]

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='employee')
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='members'
    )
    manager = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='subordinates'
    )
    phone = models.CharField(max_length=20, blank=True)
    position = models.CharField(max_length=100, blank=True)
    hire_date = models.DateField(null=True, blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    is_active = models.BooleanField(default=True)

    deactivation_reason = models.TextField(blank=True, default='')

    # Rol temporar (înlocuitor)
    temporary_role = models.CharField(
        max_length=20, choices=ROLE_CHOICES,
        null=True, blank=True
    )
    temporary_role_start = models.DateField(null=True, blank=True)
    temporary_role_end = models.DateField(null=True, blank=True)
    substituting_for = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='substituted_by'
    )

    class Meta:
        verbose_name = 'Utilizator'
        verbose_name_plural = 'Utilizatori'

    def __str__(self):
        return f'{self.get_full_name()} ({self.username})'

    @property
    def effective_role(self):
        """Returnează rolul activ — temporar dacă e în perioada de substituție."""
        if (
            self.temporary_role and
            self.temporary_role_start and
            self.temporary_role_end
        ):
            today = timezone.localdate()
            if self.temporary_role_start <= today <= self.temporary_role_end:
                return self.temporary_role
        return self.role

    @property
    def is_substituting(self):
        if (
            self.temporary_role and
            self.temporary_role_start and
            self.temporary_role_end
        ):
            today = timezone.localdate()
            return self.temporary_role_start <= today <= self.temporary_role_end
        return False

    @property
    def is_admin(self):
        return self.effective_role == 'admin'

    @property
    def is_manager(self):
        return self.effective_role in ['manager', 'director']