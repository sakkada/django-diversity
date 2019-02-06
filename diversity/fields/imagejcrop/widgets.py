import os
import json
from django import forms
from django.conf import settings
from django.utils.html import escape
from django.utils.safestring import mark_safe


class ImageJCropWidget(forms.TextInput):
    imagejcrop_use_in_admin = True

    def __init__(self, image_field=None, options=None, **kwargs):
        super(ImageJCropWidget, self).__init__(**kwargs)
        self.image_field = image_field
        self.options = options

    @property
    def media(self):
        js = tuple()
        if self.imagejcrop_use_in_admin:
            js = '' if settings.DEBUG else '.min'
            js = ('admin/js/vendor/jquery/jquery%s.js' % js,
                  'admin/js/jquery.init.js',)
        js += (
            'imagejcrop/jcrop/jquery.Jcrop.js',
            'imagejcrop/imagejcrop.js',
        )
        css = {'all': (
            'imagejcrop/jcrop/jquery.Jcrop.css',
            'imagejcrop/imagejcrop.css',
        )}

        return getattr(super(ImageJCropWidget, self),
                       'media', forms.Media()) + forms.Media(js=js, css=css)

    def render(self, name, value, attrs=None, renderer=None):
        if not attrs:
            attrs = {}
        widget = super(forms.TextInput, self).render(name, value, attrs)
        instance = getattr(value, 'instance', None)
        image = getattr(instance, self.image_field, None)
        if not instance or not image or not os.path.exists(image.path):
            return widget

        # get options, options may be callable
        options = (self.options if not callable(self.options) else
                   self.options(instance, self.image_field))
        options['initial'] = options['initial'] or {}
        options['initial'].update({'trueSize': [image.width, image.height,],})

        widget = '''<div class="jcrop-field">
    %(widget)s
    <div class="jcrop-launcher"
        data-url="%(image_url)s"
        data-options="%(options)s"
        data-target="%(target)s"></div>
    <pre class="jcrop-coords"></pre>
    <div class="jcrop-image"></div>
</div> ''' % {'widget': widget,
              'target': attrs['id'],
              'options': escape(json.dumps(options)),
              'image_url': image.url,}

        return mark_safe(widget)
