const ExtensionSystem = imports.ui.extensionSystem;
const Extension       = ExtensionSystem.ExtensionUtils.getCurrentExtension();

const CheckBox        = imports.ui.checkBox;
const Clutter         = imports.gi.Clutter;
const Gtk             = imports.gi.Gtk;
const Lang            = imports.lang;
const ModalDialog     = imports.ui.modalDialog;
const Soup            = imports.gi.Soup;
const St              = imports.gi.St;

const Utils           = Extension.imports.utils;
const Icons           = new Utils.Icons();

// Prevent Session from being garbage collected http://goo.gl/KKCYe
const Session         = new Soup.SessionAsync();

// Allow Session to work under a proxy http://goo.gl/KKCYe
Soup.Session.prototype.add_feature.call(Session,
                                        new Soup.ProxyResolverDefault());

function Dialog() {
    return this._init();
}

Dialog.prototype = {

    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function() {
        ModalDialog.ModalDialog.prototype._init.call(this);

        var self = this;

        this._buildControls();
        this._projectsToAdd = {};

        return {
          disable: function() {
              self._disconnectControls();
          },

          enable: function() {
              self._connectControls();
          },

          open: function() {
              self.open();
          }
        };

    },

    // Build modal dialog controls
    _buildControls: function() {
        this._dialogLayout.add_style_class_name('settings-dialog');

        let title = new St.Label({ style_class: 'settings-dialog-title',
                                   text: 'Projects - CI Status' });

        this.contentLayout.add(title);

        let urlLabel = new St.Label({ style_class: 'settings-dialog-label',
                                      text: 'URL' });

        this._url = new St.Entry({ style_class: 'settings-dialog-entry large',
                                   can_focus: true });

        this._url.set_secondary_icon(Icons.get('find.svg'));

        let urlBox = new St.BoxLayout({ vertical: false });
        urlBox.add(urlLabel);
        urlBox.add(this._url);

        let projectsScrollView = new St.ScrollView({
            style_class: 'cistatus-projects-area',
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            hscrollbar_policy: Gtk.PolicyType.NEVER
        });

        let projectsBox = new St.BoxLayout({ vertical: false });

        this._leftProjectsList = new St.BoxLayout({
            style_class: 'cistatus-projects-list',
            vertical: true
        });

        this._rightProjectsList = new St.BoxLayout({
            style_class: 'cistatus-projects-list',
            vertical: true
        });

        projectsBox.add(this._leftProjectsList);
        projectsBox.add(this._rightProjectsList);

        projectsScrollView.add_actor(projectsBox);

        let fieldset = new St.BoxLayout({ style_class: 'settings-dialog-fields',
                                          vertical: true });

        fieldset.add(urlBox);
        fieldset.add(projectsScrollView);

        this.contentLayout.add(fieldset);

        let closeButton = { label: 'Close',
                            key: Clutter.KEY_Escape,
                            action: Lang.bind(this, this.close) };

        this.setButtons([closeButton]);
    },

    // Remove projects list items
    _clearProjectsList: function() {
        this._leftProjectsList.destroy_all_children();
        this._rightProjectsList.destroy_all_children();
    },

    // Connect signal handlers
    _connectControls: function() {
        this._onOpenId =this.connect('opened', Lang.bind(this, this._onOpen));

        let url = this._url.clutter_text;
        this._onUrlKeyPressId = url.connect('key-press-event',
                                            Lang.bind(this,
                                                      this._onUrlKeyPress));
    },

    // Disconnect signal handlers
    _disconnectControls: function() {
        this.disconnect(this._onOpenId);
        this._url.clutter_text.disconnect(this._onUrlKeyPressId);
    },

    // Retrieve projects list from ci given its url
    _retrieveProjectsList: function() {
        this._clearProjectsList();

        let serverUrl = this._url.get_text();
        let message = Soup.Message.new('GET', serverUrl);

        let self = this;

        Session.queue_message(message, function() {
            let data = message.response_body.data;
            if (data != null) {
                let parsedData = new XML(data);
                let projectsCount = parsedData.Project.length();
                let index = 1;

                for each(let project in parsedData.Project) {
                    let name = project.@name.toString();
                    let url = project.@webUrl.toString();
                    let checkBox = new CheckBox.CheckBox(name);

                    if (index <= (projectsCount/2))
                        self._leftProjectsList.add(checkBox.actor);
                    else
                        self._rightProjectsList.add(checkBox.actor);

                    if (self._projectsToAdd[serverUrl] === undefined)
                        self._projectsToAdd[serverUrl] = {};

                    self._projectsToAdd[serverUrl][name] = { url: url,
                                                             actor: checkBox };
                    index++;
                };
            };
        });

    },

    // Set modal dialog default focus
    _onOpen: function() {
        this._url.grab_key_focus();
    },

    // Handle URL field key press event
    _onUrlKeyPress: function(actor, event) {
        if (event.get_key_symbol() == Clutter.Return)
            this._retrieveProjectsList();
    }
}