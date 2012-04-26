const Clutter     = imports.gi.Clutter;
const Lang        = imports.lang;
const ModalDialog = imports.ui.modalDialog;
const Signals     = imports.signals;
const St          = imports.gi.St;

function Dialog() {
  this._init();
}

Dialog.prototype = {

  __proto__: ModalDialog.ModalDialog.prototype,

  _init: function() {
    ModalDialog.ModalDialog.prototype._init.call(this);
    this._dialogLayout.add_style_class_name('settings-dialog');

    let title = new St.Label({ style_class: 'settings-dialog-title' });
    title.set_text(_("Settings - cistatus"));
    this.contentLayout.add(title);

    this.contentLayout.add(this._fields());

  },

  _fields: function(){

    let urlLabel = new St.Label({ style_class: 'settings-dialog-label short' });
    urlLabel.set_text(_("URL"));

    let urlEntry = new St.Entry({
      style_class: 'settings-dialog-entry large',
      can_focus: true
    });

    let url = new St.BoxLayout({ vertical: false });
    url.add(urlLabel);
    url.add(urlEntry);

    let intervalLabel = new St.Label({
      style_class: 'settings-dialog-label medium'
    });
    intervalLabel.set_text(_("Updates interval in seconds"));

    let intervalEntry = new St.Entry({
      style_class: 'settings-dialog-entry xxx-hola'
    });

    let interval = new St.BoxLayout({
      vertical: false,
      style_class: 'settings-dialog-fields'
    });
    interval.add(intervalLabel);
    interval.add(intervalEntry);

    let fields = new St.BoxLayout({
      style_class: 'settings-dialog-fields',
      vertical: true
    });

    fields.add(url);
    fields.add(interval);

    return fields;
  },

  open: function(timestamp) {
    this.setButtons([
      {
        label: "Save",
        action: Lang.bind(this, function() {
          return true
        })
      },
      {
        label: "Cancel",
        key: Clutter.KEY_Escape,
        action: Lang.bind(this, function(){
          this.close();
        })
      }
    ]);

    ModalDialog.ModalDialog.prototype.open.call(this, timestamp);
  }

};
// Add signals for event bindings
Signals.addSignalMethods(Dialog.prototype);
