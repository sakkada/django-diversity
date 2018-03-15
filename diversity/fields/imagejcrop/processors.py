# imagekit processor
class JCrop(object):
    takes_file_verion = True
    image_jcrop_field = None

    def __init__(self, image_jcrop_field=None):
        if image_jcrop_field:
            self.image_jcrop_field = image_jcrop_field

    def get_image_jcrop_field_name(self, image_field):
        return (self.image_jcrop_field if self.image_jcrop_field else
                '%s_jcrop' % image_field.name)

    def process(self, img, filever=None):
        instance, field = None, None
        if filever:
            instance = filever.data.get('instance')
            field = filever.data.get('field')
        if not all((filever, instance, field,)):
            return img

        jcrop_fname = self.get_image_jcrop_field_name(field)
        options = instance._meta.get_field(jcrop_fname).options
        options = (options if not callable(options) else
                   options(instance, field.name))
        default = options.get('default', None)

        # get jcrop value by attrname or by default name otherwise
        value = getattr(instance, jcrop_fname, None)
        value = value and value.get_value() or {}
        jcrop = value.get(filever.attrname, None)
        if jcrop is None and default:
            jcrop = value.get(default, None)
        if not jcrop or jcrop == [0,0,0,0,]:
            return img

        # crop image if it size different to jcrop value
        x, y, x2, y2 = jcrop
        width, height = abs(x2 - x), abs(y2 - y)
        if width and height and (width, height) != img.size:
            img = img.crop(jcrop)

        return img
