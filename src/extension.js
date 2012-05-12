const ExtSys    = imports.ui.extensionSystem;
const Extension = ExtSys.extensions['joigama+cistatus@gmail.com'];

const GLib      = imports.gi.GLib;
const Icons     = Extension.iconLoader;
const Lang      = imports.lang;
const Main      = imports.ui.main;
const Mainloop  = imports.mainloop;
const MsgTray   = imports.ui.messageTray;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Settings  = Extension.settings;
const Signals   = imports.signals;
const Soup      = imports.gi.Soup;
const St        = imports.gi.St;

// Prevent Session from being garbage collected http://goo.gl/KKCYe
const Session = new Soup.SessionAsync();
// Allow Session to work under a proxy http://goo.gl/KKCYe
Soup.Session.prototype.add_feature.call(Session, new Soup.ProxyResolverDefault());

function Indicator(metadata) {
  this._init(metadata)
}

Indicator.prototype = {
  __proto__: PanelMenu.ButtonBox.prototype,

  _init: function(metadata) {
    PanelMenu.ButtonBox.prototype._init.call(this, { reactive: true });

    this._icons = new Icons.Loader(metadata.path);
    this._source = new MsgTray.SystemNotificationSource();
    this._settings = new Settings.Editor(metadata.path, this._icons, this._source);

    this._buildControls();

    Main.messageTray.add(this._source); // Should I move this somewhere else ?
  },

  // Build indicator controls
  _buildControls: function() {
    this.actor.add_actor(this._icons.get('cistatus-settings'));

    this._leftMenu = new PopupMenu.PopupMenu(this.actor, 0.0, St.Side.TOP);
    this._leftMenu.actor.hide();

    this._unnableToConnectLabel = new St.Label({
      text: 'Unable to connect..',
      style_class: 'cistatus-menu-label'
    });

    this._leftMenu.addActor(this._unnableToConnectLabel);

    this._projectsMenuItems = [];

    this._rightMenu = new PopupMenu.PopupMenu(this.actor, 0.0, St.Side.TOP);
    this._rightMenu.actor.hide();

    this._settingsMenuItem = this._newMenuItem("Settings");
    this._settingsMenuItem.addActor(this._icons.get('cistatus-settings'));
    this._rightMenu.addMenuItem(this._settingsMenuItem);
  },

  // Connect signal handlers
  _connectControls: function() {
    this._indicatorOnClickId = this.actor.connect(
      'button-press-event', Lang.bind(this, this._onClick)
    );

    this._settingsMenuItemOnClickId =  this._settingsMenuItem.actor.connect(
      'button-press-event', Lang.bind(this._settings, this._settings.open)
    );

    this._onGlobalStatusChangedId = this.connect(
      'global-status-changed', Lang.bind(this, this._onGlobalStatusChanged)
    );
  },

  // Disconnect signal handlers
  _disconnectControls: function() {
    this.actor.disconnect(this._indicatorOnClickId);
    this._settingsMenuItem.actor.disconnect(this._settingsMenuItemOnClickId);
    this.disconnect(this._onGlobalStatusChangedId);
  },

  // Get CI's report
  _getStatusReport: function() {
    let message = Soup.Message.new('GET', this._settings.preferences.url);

    let self = this;

    Session.queue_message(message, function() {
      let data = message.response_body.data;
      if (data != null) {
        self._updateStatus(new XML(data));
      }
      else {
        self._globalStatus = 'cistatus-unknown';
        self.emit('global-status-changed');
      }
    });

    Mainloop.timeout_add_seconds(
      this._settings.preferences.interval,
      Lang.bind(this, this._getStatusReport)
    );
  },

  // Build new project menu item
  _newMenuItem: function(itemName){
    return new PopupMenu.PopupMenuItem(_(itemName));
  },

  // Dual click logic
  _onClick: function(actor, event) {
    switch(event.get_button()){
      case 1 :
        this._rightMenu.isOpen ? this._rightMenu.close() : undefined;
        this._leftMenu.toggle();
        break;
      case 3 :
        this._leftMenu.isOpen ? this._leftMenu.close(): undefined;
        this._rightMenu.toggle();
        break;
      default:
        break;
    }
  },

  // On global status changed callback
  _onGlobalStatusChanged: function() {
    this.actor.destroy_children();
    this.actor.add_actor(this._icons.get(this._globalStatus));

    if (this._globalStatus == 'cistatus-unknown'){
      this._removeProjectsMenuItems();
      this._unnableToConnectLabel.show();
    }
    else {
      this._unnableToConnectLabel.hide();
    }
  },

  // Disconnect event signals and remove projects menu items
  _removeProjectsMenuItems: function() {
     if(this._projectsMenuItems.length > 0) {
      for each(let projectMenuItem in this._projectsMenuItems) {
        projectMenuItem.menu_item.actor.disconnect(projectMenuItem.event_id);
        projectMenuItem.menu_item.actor.destroy_children();
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
          iconName = 'cistatus-green';
          break;
        case 'Failure':
          iconName = 'cistatus-red';
          anyFailure = true;
          break;
        default:
          iconName = 'cistatus-unknown';
      }

      let menuItem = this._newMenuItem(projectName);
      menuItem.addActor(this._icons.get(iconName));

      let menuItemOnClickId = menuItem.actor.connect(
        'button-press-event', Lang.bind(this, function() {
          this._visitProjectUrl(projectUrl);
        })
      );

      this._projectsMenuItems.push({
        menu_item: menuItem,
        event_id: menuItemOnClickId
      });

      this._leftMenu.addMenuItem(menuItem);
    }

    this._globalStatus = anyFailure == true ? 'cistatus-red' : 'cistatus-green';
    this.emit('global-status-changed');
  },

  // Open project url in the default browser
  _visitProjectUrl: function(projectUrl) {
    GLib.spawn_async_with_pipes(null, ["gnome-www-browser", "-m", projectUrl], null,
                                GLib.SpawnFlags.SEARCH_PATH, null);
  },

  enable: function() {
    Main.panel._rightBox.insert_actor(this.actor, 0);
    Main.uiGroup.add_actor(this._rightMenu.actor);
    Main.panel._menus.addMenu(this._rightMenu);
    Main.uiGroup.add_actor(this._leftMenu.actor);
    Main.panel._menus.addMenu(this._leftMenu);

    this._connectControls();
    this._settings.enable();

    if (this._settings.read()) {
      this._mainloop = Mainloop.timeout_add(0, Lang.bind(this, function() {
        this._getStatusReport();
      }));
    }
  },

  disable: function() {
    Mainloop.source_remove(this._mainloop);

    this._settings.disable();
    this._disconnectControls();
    this._removeProjectsMenuItems();

    Main.uiGroup.remove_actor(this._leftMenu.actor);
    Main.panel._menus.removeMenu(this._leftMenu);
    Main.uiGroup.remove_actor(this._rightMenu.actor);
    Main.panel._menus.removeMenu(this._rightMenu);
    Main.panel._rightBox.remove_actor(this.actor);
  }
}

Signals.addSignalMethods(Indicator.prototype);

function init(metadata) {
  return new Indicator(metadata)
}
