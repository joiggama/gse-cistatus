const CheckBox    = imports.ui.checkBox;
const Clutter     = imports.gi.Clutter;
const Gtk         = imports.gi.Gtk;
const Lang        = imports.lang;
const ModalDialog = imports.ui.modalDialog;
const Soup        = imports.gi.Soup;
const St          = imports.gi.St;

// Prevent Session from being garbage collected http://goo.gl/KKCYe
const Session = new Soup.SessionAsync();
// Allow Session to work under a proxy http://goo.gl/KKCYe
Soup.Session.prototype.add_feature.call(Session, new Soup.ProxyResolverDefault());

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
    this._fields.url.set_secondary_icon(this._icons.get('find.svg'));

    let urlBox = new St.BoxLayout({ vertical: false });
    urlBox.add(urlLabel);
    urlBox.add(this._fields.url);

    this._projectsArea = new St.ScrollView({
      vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
      hscrollbar_policy: Gtk.PolicyType.NEVER,
      style_class: 'cistatus-projects-area'
    });

    let projectsBox = new St.BoxLayout({ vertical: false });

    this._leftProjectsList = new St.BoxLayout({
      vertical: true,
      style_class: 'cistatus-projects-list'
    });

    this._rightProjectsList = new St.BoxLayout({
      vertical: true,
      style_class: 'cistatus-projects-list'
    });

    projectsBox.add(this._leftProjectsList);
    projectsBox.add(this._rightProjectsList);
    this._projectsArea.add_actor(projectsBox);

    let fieldset = new St.BoxLayout({
      style_class: 'settings-dialog-fields',
      vertical: true
    });

    fieldset.add(urlBox);
    fieldset.add(this._projectsArea);

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
    this._onOpenedId =this.connect('opened', Lang.bind(this, this._onOpen));

    this._onUrlFieldKeyPressId = this._fields.url.clutter_text.connect(
      'key-press-event', Lang.bind(this, this._onUrlFieldKeyPress)
    );
  },

  // Disconnect signal handlers
  _disconnectControls: function() {
    this.disconnect(this._onOpenedId);
    this._fields.url.clutter_text.disconnect(this._onUrlFieldKeyPressId);
  },

  // Retrieve projects list from ci given its url
  _getProjectsList: function() {
    let message = Soup.Message.new('GET', this._fields.url.get_text());

    let self = this;

    Session.queue_message(message, function() {
      data = message.response_body.data;
      if (data != null) {
        let parsedData = new XML(data);
        let projectsCount = parsedData.Project.length();
        let count = 0;
        for each(let project in parsedData.Project) {
          count++;
          let projectCheckBox = new CheckBox.CheckBox(project.@name.toString());
          if (count <= (projectsCount/2)) {
            self._leftProjectsList.add(projectCheckBox.actor);
          }
          else {
            self._rightProjectsList.add(projectCheckBox.actor);
          }
        };
      }
    });

  },

  // Set modal dialog default focus
  _onOpen: function() {
    this._fields.url.grab_key_focus();
  },

  // Handle URL field key press event
  _onUrlFieldKeyPress: function(actor, event) {
    if (event.get_key_symbol() == Clutter.Return) {
      this._getProjectsList();
    };
  },

  disable: function() {
    this._disconnectControls();
  },

  enable: function() {
    this._connectControls();
  },
}
