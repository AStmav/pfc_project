import uuid

import chatapp.models
from django.db import migrations, models


def populate_user_uuids(apps, schema_editor):
    User = apps.get_model("chatapp", "User")
    for user in User.objects.filter(uuid__isnull=True):
        value = uuid.uuid4()
        while User.objects.filter(uuid=value).exists():
            value = uuid.uuid4()
        user.uuid = value
        user.save(update_fields=["uuid"])


class Migration(migrations.Migration):
    dependencies = [
        ("chatapp", "0005_alter_user_role"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="avatar",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to=chatapp.models.user_directory_path,
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="uuid",
            field=models.UUIDField(editable=False, null=True),
        ),
        migrations.RunPython(populate_user_uuids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="uuid",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
