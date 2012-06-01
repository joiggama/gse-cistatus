const ExtensionSystem = imports.ui.extensionSystem;
const Extension       = ExtensionSystem.ExtensionUtils.getCurrentExtension();

const GLib            = imports.gi.GLib;
const Lang            = imports.lang;
const Main            = imports.ui.main;
const Mainloop        = imports.mainloop;
const MsgTray         = imports.ui.messageTray;
const PanelMenu       = imports.ui.panelMenu;
const PopupMenu       = imports.ui.popupMenu;
const Projects        = Extension.imports.projects;
const Settings        = Extension.imports.settings;
const Signals         = imports.signals;
const Soup            = imports.gi.Soup;
const St              = imports.gi.St;

const Utils           = Extension.imports.utils;
const Icons           = new Utils.Icons();
const ProjectsDialog  = new Projects.Dialog();

// Prevent Session from being garbage collected http://goo.gl/KKCYe
const Session         = new Soup.SessionAsync();

// Allow Session to work under a proxy http://goo.gl/KKCYe
Soup.Session.prototype.add_feature.call(Session,
                                        new Soup.ProxyResolverDefault());

function Indicator() {
    return this._init()
}

Indicator.prototype = {

    __proto__: PanelMenu.ButtonBox.prototype,

    _init: function(metadata) {
        PanelMenu.ButtonBox.prototype._init.call(this, { reactive: true });

        this._source = new MsgTray.SystemNotificationSource();

        this._settings = new Settings.Editor(this._source);

        this._buildControls();

        Main.messageTray.add(this._source); // Should I move this ?

        var self =  this;

        return {
            enable: function() {
                Main.panel._rightBox.insert_child_at_index(self.actor, 0);
                Main.uiGroup.add_actor(self._rightMenu.actor);
                Main.panel._menus.addMenu(self._rightMenu);
                Main.uiGroup.add_actor(self._leftMenu.actor);
                Main.panel._menus.addMenu(self._leftMenu);

                self._connectControls();
                self._settings.enable();
                ProjectsDialog.enable();

                if (self._settings.read()) {
                    let mainloopCallback = Lang.bind(self, function() {
                        self._getStatusReport();
                    });
                    self._mainloop = Mainloop.timeout_add(0, mainloopCallback);
                }
            },

            disable: function() {
                Mainloop.source_remove(self._mainloop);

                ProjectsDialog.disable();
                self._settings.disable();
                self._disconnectControls();
                self._removeProjectsMenuItems();

                Main.uiGroup.remove_actor(self._leftMenu.actor);
                Main.panel._menus.removeMenu(self._leftMenu);
                Main.uiGroup.remove_actor(self._rightMenu.actor);
                Main.panel._menus.removeMenu(self._rightMenu);
                Main.panel._rightBox.remove_actor(self.actor);
            }
        };
    },

    // Build indicator controls
    _buildControls: function() {
        this.actor.add_actor(Icons.get('settings-gear.png'));

        this._leftMenu = new PopupMenu.PopupMenu(this.actor, 0.0, St.Side.TOP);
        this._leftMenu.actor.hide();

        this._responseError = new St.Label({ style_class: 'cistatus-menu-label',
                                             text: 'Unable to connect' });

        this._leftMenu.addActor(this._responseError);

        this._projectsMenuItems = [];

        this._rightMenu = new PopupMenu.PopupMenu(this.actor, 0.0, St.Side.TOP);
        this._rightMenu.actor.hide();

        this._projectsMenuItem = new PopupMenu.PopupMenuItem(_("Projects"));
        this._projectsMenuItem.addActor(Icons.get('projects.png'));
        this._rightMenu.addMenuItem(this._projectsMenuItem);

        this._settingsMenuItem = new PopupMenu.PopupMenuItem(_("Settings"));
        this._settingsMenuItem.addActor(Icons.get('settings-gear.png'));
        this._rightMenu.addMenuItem(this._settingsMenuItem);
    },

    // Connect signal handlers
    _connectControls: function() {
        this._onClickId = this.actor.connect('button-press-event',
                                             Lang.bind(this, this._onClick));

        this._onStatusChangeId = this.connect('status-change',
                                              Lang.bind(this,
                                                        this._onStatusChange));

        this._onSyncId = this.connect('status-sync',
                                      Lang.bind(this, this._onSync));

        this._onProjectsClickId = this._projectsMenuItem.actor.connect(
          'button-press-event',
          Lang.bind(ProjectsDialog, ProjectsDialog.open));

        this._onSettingsClickId =  this._settingsMenuItem.actor.connect(
          'button-press-event',
          Lang.bind(this._settings, this._settings.open));

    },

    // Disconnect signal handlers
    _disconnectControls: function() {
        this.actor.disconnect(this._onClickId);
        this.disconnect(this._onStatusChangeId);
        this.disconnect(this._onSyncId);
        this._projectsMenuItem.actor.disconnect(this._onProjectsClickId);
        this._settingsMenuItem.actor.disconnect(this._onSettingsClickId);
    },

    // Get CI's report
    _getStatusReport: function() {
        this.emit('status-sync');

        let message = Soup.Message.new('GET', this._settings.preferences.url);

        let self = this;

        Session.queue_message(message, function() {
            let data = message.response_body.data;
            if (data != null) {
                self._updateStatus(new XML(data));
            }
            else {
                self._globalStatus = 'status-unknown';
                self.emit('status-change');
            }
        });

        Mainloop.timeout_add_seconds(this._settings.preferences.interval,
                                     Lang.bind(this, this._getStatusReport));
    },

    // Dual click logic
    _onClick: function(actor, event) {
        if (event.get_button() == 1) {
            if (this._rightMenu.isOpen)
                this._rightMenu.close();
            this._leftMenu.toggle();
        }
        else {
            if (this._leftMenu.isOpen)
                this._leftMenu.close();
            this._rightMenu.toggle();
        }
    },

    // On global status changed callback
    _onStatusChange: function() {
        this.actor.destroy_all_children();
        this.actor.add_actor(Icons.get(this._globalStatus + '.png'));

        if (this._globalStatus == 'status-unknown'){
            this._removeProjectsMenuItems();
            this._responseError.show();
        }
        else {
            this._responseError.hide();
        }
    },

    // Handle projects refresh: Change indicator icon
    _onSync: function() {
        this._globalStatus = 'status-sync';
        this.emit('status-change');
    },

    // Disconnect event signals and remove projects menu items
    _removeProjectsMenuItems: function() {
         if(this._projectsMenuItems.length > 0) {
             for each(let project in this._projectsMenuItems) {
                 project.menu_item.actor.disconnect(project.event_id);
                 project.menu_item.actor.destroy_all_children();
              };
              this._projectsMenuItems = [];
              this._leftMenu.removeAll();
        };
    },

    // Update project menu items and their statuses
    _updateStatus: function(data) {
        let anyFailure;

        this._removeProjectsMenuItems();

        for each(let project in data.Project) {

            let projectName   = project.@name.toString();
            let projectStatus = project.@lastBuildStatus.toString();
            let projectUrl    = project.@webUrl.toString();

            let iconName;

            switch(projectStatus) {
                case 'Success':
                    iconName = 'status-pass';
                    break;
                case 'Failure':
                    iconName = 'status-fail';
                    anyFailure = true;
                    break;
                default:
                    iconName = 'status-unknown';
            }

            let menuItem = new PopupMenu.PopupMenuItem(_(projectName));
            menuItem.addActor(Icons.get(iconName + '.png'));

            let onMenuItemCallback = Lang.bind(this, function() {
                this._visitProjectUrl(projectUrl);
            });

            let onMenuItemClickId = menuItem.actor.connect('button-press-event',
                                                           onMenuItemCallback);

            this._projectsMenuItems.push({ menu_item: menuItem,
                                           event_id: onMenuItemClickId });

            this._leftMenu.addMenuItem(menuItem);
        }

        this._globalStatus = anyFailure == true ? 'status-fail' : 'status-pass';
        this.emit('status-change');
    },

    // Open project url in the default browser
    _visitProjectUrl: function(url) {
        GLib.spawn_async_with_pipes(null, ["gnome-www-browser", "-m", url],
                                    null, GLib.SpawnFlags.SEARCH_PATH, null);
    },


}

Signals.addSignalMethods(Indicator.prototype);

function init() {
  return new Indicator();
}
