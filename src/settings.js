const ExtSys    = imports.ui.extensionSystem;
const Extension = ExtSys.extensions['joigama+cistatus@gmail.com'];

const Clutter     = imports.gi.Clutter;
const Gio         = imports.gi.Gio;
const Icons       = Extension.iconLoader;
const Lang        = imports.lang;
const ModalDialog = imports.ui.modalDialog;
const MsgTray     = imports.ui.messageTray;
const Shell       = imports.gi.Shell;
const Signals     = imports.signals;
const St          = imports.gi.St;
const Main        = imports.ui.main;

// Create texture cache for icons load
const Texture   = St.TextureCache.get_default();

function Editor(path, iconLoader, notificationSource) {
  this._init(path, iconLoader, notificationSource);
}

Editor.prototype = {
  __proto__: ModalDialog.ModalDialog.prototype,

  _init: function(path, iconLoader, notificationSource) {
    ModalDialog.ModalDialog.prototype._init.call(this);

    this._icons = iconLoader;
    this._source = notificationSource;
    this._settingsFile = Gio.file_new_for_path(path).get_child('preferences.json');

    this._buildControls();
  },

  // Build modal dialog controls
  _buildControls: function(){
    this._fields = {};
    this._dialogLayout.add_style_class_name('settings-dialog');

    this._title = new St.Label({ style_class: 'settings-dialog-title' });
    this._title.set_text(_("Settings - CI Status"));
    this.contentLayout.add(this._title);

    this._errorMessages = new St.BoxLayout({
      style_class: 'settings-error-messages',
      vertical: true
    });

    this.contentLayout.add(this._errorMessages);

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
      action: Lang.bind(this, function() {
        this._save();
      })
    };

    let cancelButton = {
      label: "Cancel",
      key: Clutter.KEY_Escape,
      action: Lang.bind(this, function() {
        this.close()
      })
    };

    this.setButtons([saveButton, cancelButton]);
  },

  // Connect signal handlers
  _connectControls: function() {
    this._onOpenedId =this.connect('opened', Lang.bind(this, this._onOpen));

    this._onValidationPassedId = this.connect(
      'preferences-validation-passed', Lang.bind(this, this._onValidationPassed));

    this._onValidationFailedId = this.connect(
      'preferences-validation-failed', Lang.bind(this, this._onValidationFailed));
  },

  // Disconnect signal handlers
  _disconnectControls: function() {
    this.disconnect(this._onOpenedId);
    this.disconnect(this._onValidationPassedId);
    this.disconnect(this._onValidationFailedId);
  },

  // Show notification in the system tray
  _notify: function(message, icon){
    let notification = new MsgTray.Notification(
      this._source,
      "cistatus", message,
      { icon: this._icons.get(icon) }
    );
    this._source.notify(notification);
  },

  // Set modal dialog default focus and fill with stored preferences if the exist
  _onOpen: function() {
    if (this.preferences != undefined) {
      this._fields.url.clutter_text.set_text(this.preferences.url);
      this._fields.interval.clutter_text.set_text(
        this.preferences.interval.toString());
    }
    this._fields.url.grab_key_focus();
  },

  // Callback for preferences-validation-failed signal to display errors
  _onValidationFailed: function() {
    this._errorMessages.destroy_children();

    for each(let error in this._errors){
      this._errorMessages.add(new St.Label({ text: error}));
    }
  },

  // Callback for preferences-validation-passed signal to fire settings write
  _onValidationPassed: function() {
    this._errorMessages.destroy_children();

    this.preferences.url = this._fields.url.clutter_text.get_text();
    this.preferences.interval = parseInt(this._fields.interval.clutter_text.get_text());

    if (this.write()) {
      this._notify('The preferences were saved correctly.', 'cistatus-settings')
      this.close();
    }
  },

  // Save settings preferences logic
  _save: function() {
    this.emit('preferences-validation-' + (this._validate() ? 'passed' : 'failed'));
  },

  // Validation of settings modal dialog fields
  _validate: function() {
    let url = this._fields.url.clutter_text.get_text();
    let interval = parseInt(this._fields.interval.clutter_text.get_text());

    this._errors = [];

    let urlRegexp = /(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;

    if (!urlRegexp.test(url)){
       this._errors.push("* Invalid URL");
    };

    if ((interval < 10) || (interval > 1800) || isNaN(interval)){
      this._errors.push("* Refresh interval must be between 10 and 1700 seconds");
    }

    return this._errors.length > 0 ? false : true
  },

  disable: function() {
    this._disconnectControls();
  },

  enable: function() {
    this._connectControls();
  },

  // Read from settings file preferences.json
  read: function() {
    let preferences;

    if (this._settingsFile.query_exists(null)) {

      try {
        preferences = JSON.parse(
          Shell.get_file_contents_utf8_sync(this._settingsFile.get_path())
        );
      }
      catch(e) {
        global.logError('Something went wrong reading preferences.json: ' + e);
      }
      finally {
        if (preferences != undefined) {
          this.preferences = preferences;
          return true;
        }
        else {
          return false;
        }
      }

    }
  },

  // Write to settings file preferences.json
  write: function() {
    let raw = this._settingsFile.replace(null, false, Gio.FileCreateFlags.NONE,
                                         null);
    let output = Gio.BufferedOutputStream.new_sized(raw, 4096);
    let status;

    try {
      status = Shell.write_string_to_stream(output,
                                            JSON.stringify(this.preferences));
    }
    catch(e){
      global.logError('Something went wrong writing preferences.json: ' + e);
    }
    finally{
      output.close(null);
      return status == undefined ? false : true;
    }
  }

};

Signals.addSignalMethods(Editor.prototype);
