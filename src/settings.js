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

    let fields = new St.BoxLayout({ style_class: 'settings-dialog-fields'});
    let labels = new St.BoxLayout({vertical: true});
    let inputs = new St.BoxLayout({vertical: true});

    let label = new St.Label();
    label.set_text(_("URL "));

    labels.add(label, {
      x_align: St.Align.START,
      x_fill: true,
      x_expand: true 
    });

    this._url = new St.Entry({
      style_class: 'settings-dialog-entry',
      can_focus: true 
    });

    inputs.add(this._url, {
      x_align: St.Align.END,
      x_fill: false,
      x_expand: true
    });

    fields.add(labels);
    fields.add(inputs);

    this._dialogLayout.style_class = 'settings-dialog modal-dialog';
    this.contentLayout.add(fields, {
      style_class: 'settings-dialog',
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
