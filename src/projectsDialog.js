const Clutter     = imports.gi.Clutter;
const Lang        = imports.lang;
const ModalDialog = imports.ui.modalDialog;
const St          = imports.gi.St;

function Dialog(path, iconLoader, notificationSource) {
  this._init(path, iconLoader, notificationSource);
}

Dialog.prototype = {
  __proto__: ModalDialog.ModalDialog.prototype,

  _init: function(path, iconLoader, notificationSource) {
    ModalDialog.ModalDialog.prototype._init.call(this);

    this._icons = iconLoader;
    this._buildControls();
    this.enable();
  },

  // Build modal dialog controls
  _buildControls: function() {
    this._fields = {};
    this._dialogLayout.add_style_class_name('settings-dialog');

    this._title = new St.Label({
      style_class: 'settings-dialog-title',
      text: 'Projects - CI Status'
    });

    this.contentLayout.add(this._title);

    let urlLabel = new St.Label({
      style_class: 'settings-dialog-label',
      text: 'URL'
    });

    this._fields.url = new St.Entry({
      style_class: 'settings-dialog-entry large',
      can_focus: true
    });

    let urlBox = new St.BoxLayout({ vertical: false });
    urlBox.add(urlLabel);
    urlBox.add(this._fields.url);

    let projectsList = new St.BoxLayout({
      vertical: false,
      style_class: 'cistatus-projects-list'
    });

    let fieldset = new St.BoxLayout({
      style_class: 'settings-dialog-fields',
      vertical: true
    });

    fieldset.add(urlBox);
    fieldset.add(projectsList);

    this.contentLayout.add(fieldset);

    let closeButton = {
      label: 'Close',
      key: Clutter.KEY_Escape,
      action: Lang.bind(this, this.close)
    };

    this.setButtons([closeButton]);
  },

  // Connect signal handlers
  _connectControls: function() {
    this._urlFieldOnReturnId = this._fields.url.clutter_text.connect(
      'key-press-event', Lang.bind(this, this._onUrlFieldKeyPress)
    );
  },

  // Disconnect signal handlers
  _disconnectControls: function() {
    this._fields.url.clutter_text.disconnect(this._urlFieldOnReturnId);
  },

  // Handle URL field key press event
  _onUrlFieldKeyPress: function(actor, event) {
    if (event.get_key_symbol() == Clutter.Return){
      return undefined;
    };
  },

  disable: function() {
    this._disconnectControls();
  },

  enable: function() {
    this._connectControls();
  },
}
