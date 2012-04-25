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


    let fieldset = new St.BoxLayout({ style_class: 'settings-dialog-fields' });

    let url = new St.BoxLayout({ vertical: false });

    let urlLabel = new St.Label({ style_class: 'settings-dialog-label' });
    urlLabel.set_text(_("URL"));

    url.add(urlLabel, { x_align: St.Align.START });

    let urlEntry = new St.Entry({
      style_class: 'settings-dialog-entry',
      can_focus: true 
    });

    url.add(urlEntry, {
      x_align: St.Align.END
    });

    fieldset.add(url);

    this.contentLayout.add(fieldset, {
      y_align: St.Align.START
    });

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
