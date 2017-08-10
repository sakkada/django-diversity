// require jQuery
// require jQuery Jcrop (http://github.com/tapmodo/Jcrop)
(function($){

  // utils
  // -----
  function safeJSONParse(string) {
    var result = null;
    try {
      result = JSON.parse(string);
    } catch(e) {
      result = {};
    }
    return result;
  }

  // get/set field string value
  function getFieldValue(field) {
    return safeJSONParse(field.val())[field.data('current')];
  }

  function setFieldValue(field, value) {
    var cropval, origval, currval, current,
        data = safeJSONParse(field.val()),
        origdata = field.data('value'),
        enabled = field.data('enabled');

    if (Object.prototype.toString.call(data) !== '[object Object]') {
      data = {};
    }

    current = field.data('current');
    cropval = JSON.stringify(rectangleIsEmpty(data[current]) ? [0,0,0,0] : data[current]);
    origval = JSON.stringify(rectangleIsEmpty(origdata[current]) ? [0,0,0,0] : origdata[current]);
    currval = JSON.stringify(value);

    if (!enabled) {
      field.data('enabled', true);
      if (cropval != currval) {
        enableIcon(field, 'distortion');
      }
      if (cropval != origval) {
        enableIcon(field, 'savedvalue');
      }
    } else {
      data[current] = value;
      field.val(JSON.stringify(data));
      if (currval != origval) {
        enableIcon(field, 'savedvalue');
      } else {
        disableIcon(field, 'savedvalue');
      }
    }
  }

  // convert rectangle to selection and vice versa
  function rectangleToSelection(r) {
    return {x: r[0], y: r[1], x2: r[2], y2: r[3], w: r[2]-r[0], h: r[3]-r[1]};
  }

  function selectionToRectangle(c) {
    return [Math.round(c.x), Math.round(c.y), Math.round(c.x2), Math.round(c.y2)];
  }

  // rectangle value is empty
  function rectangleIsEmpty(r) {
    return !r || (r[0] == 0 && r[1] == 0 && r[2] == 0 && r[3] == 0);
  }

  // enable/disable icons
  function enableIcon(field, icon) {
    field.parents('.jcrop-field').find('[data-type=icon][data-name="' + icon + '"]')
         .addClass('jcrop-icon-enabled');
  }

  function disableIcon(field, icon) {
    field.parents('.jcrop-field').find('[data-type=icon][data-name="' + icon + '"]')
         .removeClass('jcrop-icon-enabled');
  }

  // max cropping rectangle
  function maxCropping(ratio, maxSize, trueSize) {
    var offset,
        wtrue = trueSize[0], htrue = trueSize[1],
        wmax = trueSize[0], hmax = trueSize[1];

    if (maxSize && (maxSize[0] || maxSize[1])) {
      wmax = maxSize[0] && maxSize[0] <= trueSize[0] ? maxSize[0] : wmax;
      hmax = maxSize[1] && maxSize[1] <= trueSize[1] ? maxSize[1] : hmax;
    }

    if (!ratio) {
      // full available size
      offset = [Math.round((wtrue-wmax)/2), Math.round((htrue-hmax)/2)];
    } else if (wmax/hmax > ratio) {
      // height fits fully, width needs to be cropped
      offset = [Math.round((wtrue-hmax*ratio)/2), Math.round((htrue-hmax)/2)];
    } else {
      // width fits fully, height needs to be cropped
      offset = [Math.round((wtrue-wmax)/2), Math.round((htrue-wtrue/ratio)/2)];
    }
    // result rectangle
    return [offset[0], offset[1], wtrue-offset[0], htrue-offset[1]];
  }

  // show hide coordinates string
  function hideCoords(field) {
    field.parents('.jcrop-field').find('.jcrop-coords').html(null).hide();
  }

  function showCoords(field, c) {
    var container = field.parents('.jcrop-field').find('.jcrop-coords'),
        rectangle = selectionToRectangle(c);
    container.html(
           'x1, y1: (' + Math.round(c.x)  + ', ' + Math.round(c.y)  + ')'
      + ' | x2, y2: (' + Math.round(c.x2) + ', ' + Math.round(c.y2) + ')'
      + ' | w: ' + Math.round(c.w)    + ', h: ' + Math.round(c.h)
      + ' | [' + rectangle + ']'
    ).show();
  }

  // handlers
  // --------
  function jcropLaunch(e) {
    e.preventDefault();
    var self = $(this),
        launcher = self.parents('.jcrop-launcher'),
        container = self.parents('.jcrop-field'),
        field = container.find('#' + launcher.data('target')),
        image = container.find('.jcrop-image'),
        JCROPAPI = container.data('JCROPAPI'),
        jsondata = null,
        onSuccess = null;

    // options
    var optdata = launcher.data('options'),
        optname = self.data('name'),
        options = optdata.data[optname],
        initial = $.extend({}, optdata.initial),
        rectangle = null;

    if (options.minSize && initial.trueSize && !initial.trueSize.every(function(item, index){
          return options.minSize[index] ? item >= options.minSize[index] : true;
        })) {
      alert('Attention!'
            + '\nImage you want to crop should be larger than minSize.'
            + '\nRequired minSize: [' + options.minSize + '] (width,height).'
            + '\nImage real size: [' + initial.trueSize + '] (width,height).');
      return;
    }

    // realsize boxview
    if (!!field.data('realsize')) {
      delete initial.boxWidth;
      delete initial.boxHeight;
    }

    jsondata = safeJSONParse(field.val());
    if (jsondata[optname]) {
      rectangle = jsondata[optname];
    }
    rectangle = rectangleIsEmpty(rectangle) ? null : rectangle;

    // disable icons and launchers, highlight version link
    container.find('[data-type=launch]').removeClass('jcrop-option-enabled');
    container.find('[data-type=icon]').removeClass('jcrop-icon-enabled');
    self.addClass('jcrop-option-enabled');

    // set initial state and current
    field.data('current', optname)
         .data('enabled', false);

    // closure for both initialization and reconfigure cases
    onSuccess = function() {
      JCROPAPI.setOptions(options);
      JCROPAPI.focus();
      options = JCROPAPI.getOptions();
      if (!options.allowSelect && !rectangle) {
        rectangle = maxCropping(options.aspectRatio, options.maxSize, initial.trueSize);
      }
      rectangle ? JCROPAPI.setSelect(rectangle)
                : JCROPAPI.release();
    }

    // initialize Jcrop
    if (!JCROPAPI) {
      image.children().remove();
      image.append($('<img src="' + launcher.data('url') + '">'));
      // jQuerySelector.Jcrop(options, onSuccess) used instead $.Jcrop(obj, options)
      // because onSuccess will be called after full initialization, in second case
      // JCROPAPI is not ready for work immediatelly and whole script crushes from
      // time to time and works only after close->reopen
      JCROPAPI = image.find('img').Jcrop(
        $.extend({}, {
          onChange: function(c) { showCoords(field, c); },
          onSelect: function(c) {
            setFieldValue(field, selectionToRectangle(c));
            showCoords(field, c);
          },
          onRelease: function () {
            setFieldValue(field, [0,0,0,0]);
            showCoords(field, {x: 0, y: 0, x2: 0, y2: 0, w: 0, h: 0});
          },
        }, initial),
        function() {
          // get JCROPAPI for onSuccess closure, run onSuccess and
          // save JCROPAPI instance in current container for future reusing
          JCROPAPI = this;
          onSuccess();
          container.data('JCROPAPI', JCROPAPI);
        }
      );
    } else {
      onSuccess();
    }
  }

  function jcropClose(e){
    e.preventDefault();

    var self = $(this),
        launcher = self.parents('.jcrop-launcher'),
        container = self.parents('.jcrop-field'),
        field = container.find('#' + launcher.data('target')),
        JCROPAPI = container.data('JCROPAPI');

    // destroy jcrop, jcrop api instance and current value
    if (JCROPAPI) {
      container.removeData('JCROPAPI');
      JCROPAPI.destroy();
    }
    field.removeData('current');

    // disable icons and launchers, remove image, hide coords
    container.find('.jcrop-image').children().remove();
    container.find('[data-type=launch]').removeClass('jcrop-option-enabled');
    container.find('[data-type=icon]').removeClass('jcrop-icon-enabled');
    hideCoords(field);
  }

  function jcropRevertValue(e) {
    e.preventDefault();

    var self = $(this),
        launcher = self.parents('.jcrop-launcher'),
        container = self.parents('.jcrop-field'),
        field = container.find('#' + launcher.data('target')),
        JCROPAPI = container.data('JCROPAPI'),
        data = safeJSONParse(field.val()),
        origdata = field.data('value'),
        current = field.data('current'),
        cropval, origval;

    if (!current) return;

    origval = rectangleIsEmpty(origdata[current]) ? [0,0,0,0] : origdata[current];
    cropval = rectangleIsEmpty(data[current]) ? [0,0,0,0] : data[current];

    if (JSON.stringify(cropval) == JSON.stringify(origval)) return;

    if (rectangleIsEmpty(origval)) {
      JCROPAPI.release();
    } else {
      // set value to field
      setFieldValue(field, origval);
      // reinit field and icons state and set selection
      container.find('[data-type=icon]').removeClass('jcrop-icon-enabled');
      field.data('enabled', false);
      JCROPAPI.setSelect(origval);
    }
  }

  function jcropToggleField(e) {
    e.preventDefault();

    var self = $(this),
        launcher = self.parents('.jcrop-launcher'),
        field = self.parents('.jcrop-field').find('#' + launcher.data('target'));

    self.toggleClass('jcrop-option-enabled');
    field.toggleClass('jcrop-field-visible');
  }

  function jcropRealSize(e){
    e.preventDefault();

    var self = $(this),
        container = self.parents('.jcrop-field'),
        launcher = self.parents('.jcrop-launcher'),
        field = container.find('#' + launcher.data('target')),
        current = field.data('current'),
        realsize = field.data('realsize');

    field.data('realsize', !realsize);
    realsize ? self.removeClass('jcrop-option-enabled')
             : self.addClass('jcrop-option-enabled');

    if (current) {
      container.find('a[data-type=close]').trigger('click');
      container.find('a[data-name=' + current + ']').trigger('click');
    }
  }

  function jcropMaximize(e){
    e.preventDefault();

    var self = $(this),
        launcher = self.parents('.jcrop-launcher'),
        container = self.parents('.jcrop-field'),
        field = container.find('#' + launcher.data('target')),
        JCROPAPI = container.data('JCROPAPI'),
        optdata = launcher.data('options'),
        current = field.data('current'),
        options = optdata.data[current],
        initial = optdata.initial,
        rectangle;

    if (!JCROPAPI || !initial || !options) return;

    rectangle = maxCropping(options.aspectRatio, options.maxSize, initial.trueSize);
    JCROPAPI.setSelect(rectangle);
  }

  function jcropInfo(e){
    e.preventDefault();

    var self = $(this), value,
        launcher = self.parents('.jcrop-launcher'),
        container = self.parents('.jcrop-field'),
        field = container.find('#' + launcher.data('target')),
        JCROPAPI = container.data('JCROPAPI'),
        infotag = self.parent().find('.jcrop-info'),
        enabled = self.data('enabled');

    var optdata = launcher.data('options'),
        current = field.data('current'),
        options = optdata.data[current],
        initial = optdata.initial;

    // get pretty printed information
    value = {'fieldValue': safeJSONParse(field.val()),
             'fieldRealValue': field.val(),};
    if (JCROPAPI && initial && options) {
      $.extend(value, {'jcropOptions': options,
                       'jcropInitialOptions': initial});
    }
    value = JSON.stringify(value, null, '  ');

    // show or hide information
    if (e.type == 'click') {
      self.data('enabled', !enabled);
      if (enabled) {
        self.removeClass('jcrop-option-enabled');
        infotag.removeClass('jcrop-info-visible').html('');
      } else {
        self.addClass('jcrop-option-enabled');
        infotag.addClass('jcrop-info-visible').html(value);
      }
    } else if (!enabled) {
      if (e.type == 'mouseleave') {
        infotag.removeClass('jcrop-info-visible').html('');
      } else {
        infotag.addClass('jcrop-info-visible').html(value);
      }
    }
  }

  // window load handler
  // -------------------
  $(function() {
    $('.jcrop-launcher').each(function(index, element) {
      var self = $(this),
          optdata = self.data('options'),
          field = self.parents('.jcrop-field').find('#' + self.data('target')),
          links = [];

      Object.keys(optdata.data).forEach(function(elem) {
        links.push(
          '<a data-type="launch" data-name="' + elem + '" href="javascript:void(0);"><b>' + elem + '</b></a>'
        );
      });

      // save original value and set initial state
      field.data('value', safeJSONParse(field.val()))
           .data('enabled', false);

      links = links.join(',&nbsp;')
              + ' (<a data-type="close" href="javascript:void(0);">close</a>)'
              + ' | <a href="javascript:void(0);" data-type="icon" data-name="distortion" class="jcrop-icon" title="Distortion of the scaling">&#9706;</a>'
              +    '<a href="javascript:void(0);" data-type="icon" data-name="savedvalue" class="jcrop-icon" title="Value saved to form field">&#11035;</a>'
              + ' | selection: <a data-type="maximize" href="javascript:void(0);">maximize</a>,'
              +   ' <a data-type="revert" href="javascript:void(0);">revert</a>'
              + ' | image: <a data-type="realsize" data-enabled="false" href="javascript:void(0);">realsize</a>'
              + ' (<a data-type="togglefield" href="javascript:void(0);">field</a>,'
              +  ' <a data-type="info" href="javascript:void(0);">info</a>)'
              + ' <pre class="jcrop-info"></pre>';

      self.children().remove();
      self.append(links);
      self.find('a[data-type=launch]').click(jcropLaunch);
      self.find('a[data-type=close]').click(jcropClose);
      self.find('a[data-type=maximize]').click(jcropMaximize);
      self.find('a[data-type=revert]').click(jcropRevertValue);
      self.find('a[data-type=realsize]').click(jcropRealSize);
      self.find('a[data-type=togglefield]').click(jcropToggleField);
      self.find('a[data-type=info]').hover(jcropInfo, jcropInfo).click(jcropInfo);
    });
  });

})(django && django.jQuery ? django.jQuery : jQuery); // django.jQuery also support
