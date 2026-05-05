from django.db import models
from django.conf import settings
from django.utils import timezone


class Attendance(models.Model):
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
        ('half_day', 'Half Day'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='attendances'
    )
    date = models.DateField(default=timezone.now)
    check_in = models.TimeField(null=True, blank=True)
    check_out = models.TimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='present')
    notes = models.TextField(blank=True)
    work_hours = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Attendance'
        verbose_name_plural = 'Attendances'
        unique_together = ['user', 'date']
        ordering = ['-date']

    def __str__(self):
        return f'{self.user.username} - {self.date}'

    def calculate_work_hours(self):
        if self.check_in and self.check_out:
            from datetime import datetime, date
            check_in_dt = datetime.combine(date.today(), self.check_in)
            check_out_dt = datetime.combine(date.today(), self.check_out)
            diff = check_out_dt - check_in_dt
            hours = diff.total_seconds() / 3600
            self.work_hours = round(hours, 2)
            self.save(update_fields=['work_hours'])
            return self.work_hours
        return None