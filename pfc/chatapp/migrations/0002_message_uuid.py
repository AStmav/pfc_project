import uuid

from django.db import migrations, models


def populate_message_uuids(apps, schema_editor):
    Message = apps.get_model("chatapp", "Message")
    for message in Message.objects.filter(uuid__isnull=True):
        value = uuid.uuid4()
        while Message.objects.filter(uuid=value).exists():
            value = uuid.uuid4()
        message.uuid = value
        message.save(update_fields=["uuid"])


class Migration(migrations.Migration):

    dependencies = [
        ("chatapp", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="message",
            name="uuid",
            field=models.UUIDField(
                db_index=True,
                editable=False,
                null=True,
            ),
        ),
        migrations.RunPython(populate_message_uuids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="message",
            name="uuid",
            field=models.UUIDField(
                db_index=True,
                default=uuid.uuid4,
                editable=False,
                null=False,
                unique=True,
            ),
        ),
    ]
