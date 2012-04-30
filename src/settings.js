const Clutter     = imports.gi.Clutter;
const Gio         = imports.gi.Gio;
const Lang        = imports.lang;
const ModalDialog = imports.ui.modalDialog;
const Shell       = imports.gi.Shell;
const Signals     = imports.signals;
const St          = imports.gi.St;

function Editor(path) {
  this._init(path);
}

Editor.prototype = {

  // Build over a Shell ModalDialog
  __proto__: ModalDialog.ModalDialog.prototype,

  // Intialize object
  _init: function(path) {
    ModalDialog.ModalDialog.prototype._init.call(this);

    // Grab settings file
    this._settingsFile = Gio.file_new_for_path(path).get_child('preferences.json');

    this._setBindings();
    this._setFields();
  },

  // Set modal dialog default focus
  _onOpen: function(){
    this._fields.url.grab_key_focus();
  },

  // Set event bindings
  _setBindings: function(){
    this.connect('opened', Lang.bind(this, this._onOpen));
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
  },

  // Read from settings file preferences.json
  read: function(){
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
