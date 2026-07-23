from django.conf import settings
from django.db import models


class PontajSheet(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('generated', 'Generated'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    department = models.ForeignKey(
        'accounts.Department', on_delete=models.CASCADE, related_name='pontaj_sheets',
        null=True, blank=True
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='personal_pontaj_sheets',
        null=True, blank=True,
        help_text='Set instead of department for a self-service personal sheet (e.g. the director\'s own).'
    )
    year = models.PositiveIntegerField()
    month = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='pontaj_sheets_generated'
    )
    generated_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='pontaj_sheets_reviewed'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['department', 'year', 'month'],
                condition=models.Q(department__isnull=False),
                name='uniq_department_pontaj_sheet',
            ),
            models.UniqueConstraint(
                fields=['user', 'year', 'month'],
                condition=models.Q(user__isnull=False),
                name='uniq_personal_pontaj_sheet',
            ),
        ]
        ordering = ['-year', '-month']

    def __str__(self):
        owner = self.department.name if self.department_id else self.user.get_full_name()
        return f'{owner} {self.year}-{self.month:02d} ({self.status})'


class PontajEntry(models.Model):
    sheet = models.ForeignKey(PontajSheet, on_delete=models.CASCADE, related_name='entries')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='pontaj_entries'
    )
    day = models.PositiveSmallIntegerField()
    hours = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    leave_code = models.CharField(max_length=4, blank=True, default='')
    is_edited = models.BooleanField(default=False)
    leave_from_request = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['sheet', 'user', 'day']
        ordering = ['user__last_name', 'user__first_name', 'day']

    def __str__(self):
        return f'{self.sheet_id} - {self.user.username} - day {self.day}'
