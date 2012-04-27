const Clutter     = imports.gi.Clutter;
const Lang        = imports.lang;
const ModalDialog = imports.ui.modalDialog;
const Signals     = imports.signals;
const St          = imports.gi.St;

function Editor() {
  this._init();
}

Editor.prototype = {

  __proto__: ModalDialog.ModalDialog.prototype,

  _init: function() {
    ModalDialog.ModalDialog.prototype._init.call(this);
    this._dialogLayout.add_style_class_name('settings-dialog');

    this._setFields();
    this.connect('opened', Lang.bind(this, this._onOpened));
  },

  _onOpened: function(){
    this._fields.url.grab_key_focus();
  },

  _setFields: function(){
    this._fields = {};

    this._title = new St.Label({ style_class: 'settings-dialog-title' });
    this._title.set_text(_("Settings - cistatus"));
    this.contentLayout.add(this._title);

    let urlLabel = new St.Label({ style_class: 'settings-dialog-label' });
    urlLabel.set_text(_("URL"));

    this._fields.url = new St.Entry({
      style_class: 'settings-dialog-entry large',
      can_focus: true
    });

    let url = new St.BoxLayout({ vertical: false });
    url.add(urlLabel);
    url.add(this._fields.url);

    let intervalLabel = new St.Label({
      style_class: 'settings-dialog-label short'
    });
    intervalLabel.set_text(_("Refresh interval in seconds"));

    this._fields.interval = new St.Entry({
      style_class: 'settings-dialog-entry medium'
    });

    let interval = new St.BoxLayout({
      vertical: false,
      style_class: 'settings-dialog-fields'
    });
    interval.add(intervalLabel);
    interval.add(this._fields.interval);

    let fieldset = new St.BoxLayout({
      style_class: 'settings-dialog-fields',
      vertical: true
    });

    fieldset.add(url);
    fieldset.add(interval);

    this.contentLayout.add(fieldset);

    let saveButton = {
      label: "Save",
      action: function() {
        return true
      }
    };

    let cancelButton = {
      label: "Cancel",
      key: Clutter.KEY_Escape,
      action: Lang.bind(this, function() {
        this.close()
      })
    };

    this.setButtons([saveButton, cancelButton]);
  }
};
// Add signals for event bindings
Signals.addSignalMethods(Editor.prototype);
