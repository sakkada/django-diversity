import json
from django.db import models
from .widgets import ImageJCropWidget


class UnicodeValueWithInstance(unicode):
    def get_value(self):
        try:
            data = json.loads(self)
        except ValueError:
            data = {}
        return data


class ImageJCropDescriptor(object):
    def __init__(self, field):
        self.field = field

    def __get__(self, instance=None, owner=None):
        value = instance.__dict__[self.field.name]
        value = UnicodeValueWithInstance(value)
        value.instance = instance
        return value

    def __set__(self, instance, value):
        instance.__dict__[self.field.name] = unicode(value)


class ImageJCropField(models.CharField):
    """
    Allowed options keys:
        data (dict with image versions configurations, each item
              is jquery JCrop options value, see more in JCrop docs):
            aspectRatio     - 4.0/3
            minSize         - (10, 10,)
            maxSize         - (500, 500,)
            allowSelect     - True          # allow to disable cropping
            allowMove       - True          # allow to move selection
            allowResize     - True          # allow to resize selection

        initial (Jcrop instance initialize options):
            boxWidth        - 800           # widget width
            boxHeight       - 460           # widget height
            trueSize        - (1920, 1080,) # get automatically from image

        default (version which will be used in JCrop imagekit processor
                 if current filever.attrname version is not found)
    """

    def __init__(self, verbose_name=None, image_field=None, options=None,
                 **kwargs):
        self.image_field = image_field or None
        self.options = options or {}

        kwargs = dict({
            'max_length': 255,
            'default': '',
            'blank': True,
        }, verbose_name=verbose_name, **kwargs)
        super(ImageJCropField, self).__init__(**kwargs)

    def contribute_to_class(self, cls, name):
        super(ImageJCropField, self).contribute_to_class(cls, name)
        setattr(cls, self.name, ImageJCropDescriptor(self))
        if not self.image_field:
            if not self.name[-6:] == '_jcrop':
                raise ValueError(
                    'ImageJCropField: custom image_field is not defined and'
                    ' name of jcrop field is not ends with "_jcrop".'
                )
            self.image_field = self.name[:-6]

    def formfield(self, *args, **kwargs):
        kwargs['widget'] = ImageJCropWidget(
            image_field=self.image_field, options=self.options
        )
        return super(ImageJCropField, self).formfield(*args, **kwargs)

    def pre_save(self, instance, add):
        while True:
            value = getattr(instance, self.name)
            image = getattr(instance, self.image_field)
            if not image:
                break

            previous = instance.pk and type(instance).objects.filter(
                pk=instance.pk).values_list(self.name, flat=True)[0]
            changed = not previous == value

            # cropping already set and not changed
            if value and not changed:
                break
            elif not value:
                # calculate initial cropping
                options = (self.options(instance, self.name)
                           if callable(self.options) else self.options)
                options = options.get('data', {})

                try:
                    true_size = (image.width, image.height,)
                except IOError:
                    break

                value = {}
                for key, val in options.items():
                    aspect_ratio = val.get('aspectRatio', None)
                    max_size = val.get('maxSize', None)
                    allow_empty = val.get('allowSelect', True)
                    if not allow_empty:
                        value[key] = self.max_cropping(aspect_ratio,
                                                       max_size, true_size)
                if value:
                    changed = True
                    setattr(instance, self.name, json.dumps(value))

            # update versions
            if changed:
                instance._meta.get_field(self.image_field).set_action(
                    instance, '__update__')
            break

        return super(ImageJCropField, self).pre_save(instance, add)

    def max_cropping(self, aspect_ratio, max_size, true_size):
        offset, (wtrue, htrue,), (wmax, hmax,) = 0, true_size, true_size

        if max_size:
            wmax = max_size[0] if max_size[0] <= wtrue else wmax;
            hmax = max_size[1] if max_size[1] <= htrue else hmax;

        wtrue, htrue, wmax, hmax = map(float, [wtrue, htrue, wmax, hmax,])

        if not aspect_ratio:
            # full available size
            offset = [round((wtrue-wmax)/2),
                      round((htrue-hmax)/2),]
        elif wmax/hmax > aspect_ratio:
            # height fits fully, width needs to be cropped
            offset = [round((wtrue-hmax*aspect_ratio)/2),
                      round((htrue-hmax)/2)]
        else:
            # width fits fully, height needs to be cropped
            offset = [round((wtrue-wmax)/2),
                      round((htrue-wtrue/aspect_ratio)/2)]

        # result rectangle
        box = [offset[0], offset[1], wtrue-offset[0], htrue-offset[1]]
        box = map(lambda x: int(round(x)), box)
        return box
