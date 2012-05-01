const Clutter     = imports.gi.Clutter;
const Gio         = imports.gi.Gio;
const Lang        = imports.lang;
const ModalDialog = imports.ui.modalDialog;
const Shell       = imports.gi.Shell;
const Signals     = imports.signals;
const St          = imports.gi.St;
const MessageTray = imports.ui.messageTray;
const Main        = imports.ui.main;

// Create texture cache for icons load
const Texture   = St.TextureCache.get_default();

function Editor(path) {
  this._init(path);
}

Editor.prototype = {

  // Build over a Shell ModalDialog
  __proto__: ModalDialog.ModalDialog.prototype,

  // Intialize object
  _init: function(path) {
    ModalDialog.ModalDialog.prototype._init.call(this);
    this._path = path;

    // Grab settings file
    this._settingsFile = Gio.file_new_for_path(path).get_child('preferences.json');

    this._setBindings();
    this._setFields();
    this._setNotificationSource();
  },

  // Load icon from local dir
  _newIcon: function(iconName) {
    let icon_uri = 'file://' + this._path + '/icons/' + iconName +'.png';
    return Texture.load_uri_async(icon_uri, 16, 16)
  },

  // Show notification in the system tray
  _notify: function(message, icon){
    let notification = new MessageTray.Notification(this._notificationSource,
                                                    "cistatus", message,
                                                    { icon: this._newIcon(icon) } );
    this._notificationSource.notify(notification);
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

  // Callback for preferences-saved signal to fire settings write
  _onSaved: function() {
    if (this.write()) {
      this._notify('The preferences were saved correctly.', 'cistatus-settings')
      this.close();
    }
  },

  // Save settings preferences logic
  _save: function() {
    params = {
      url: this._fields.url.clutter_text.get_text(),
      interval: this._fields.interval.clutter_text.get_text()
    }

    if (this._validate(params) == true) {
      this.preferences.url = this._fields.url.clutter_text.get_text();
      this.preferences.interval = parseInt(this._fields.interval.clutter_text.get_text());
      this.emit('preferences-saved');
    }
    else {
      global.log('preferences not saved');
    }

  },

  // Set event bindings
  _setBindings: function() {
    this.connect('opened', Lang.bind(this, this._onOpen));
    this.connect('preferences-saved', Lang.bind(this, this._onSaved));
  },

  // Build modal dialog controls
  _setFields: function(){
    this._fields = {};
    this._dialogLayout.add_style_class_name('settings-dialog');

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

  // Create a notification source for all settings related notifications
  _setNotificationSource: function() {
    this._notificationSource = new MessageTray.SystemNotificationSource();
    Main.messageTray.add(this._notificationSource);
  },

  // Validation of settings modal dialog fields
  _validate: function(params) {
    this._errors = { url: null, interval: null };

    let urlRegexp = /(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;

    if (!urlRegexp.test(params.url)){
       this._errors.url = "Invalid URL";
    };


    let intervalValue = parseInt(params.interval);
    if ((intervalValue < 10) || (intervalValue > 1800) || isNaN(intervalValue)){
      this._errors.interval = "Update interval must be between 10 seconds and half an hour";
    }

    if ((this._errors.url == null) && (this._errors.interval == null)){
      return true
    }
    else{
      return false
    }
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

// Add signals for event bindings
Signals.addSignalMethods(Editor.prototype);
