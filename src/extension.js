const ExtSys    = imports.ui.extensionSystem;
const Extension = ExtSys.extensions['joigama+cistatus@gmail.com'];

const GLib      = imports.gi.GLib;
const Lang      = imports.lang;
const Main      = imports.ui.main;
const Mainloop  = imports.mainloop;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Settings  = Extension.settings;
const Signals   = imports.signals;
const Soup      = imports.gi.Soup;
const St        = imports.gi.St;

// Prevent Session from being garbage collected http://goo.gl/KKCYe
const Session   = new Soup.SessionAsync();

// Create texture cache for icons load
const Texture   = St.TextureCache.get_default();

// Allow Session to work under a proxy http://goo.gl/KKCYe
Soup.Session.prototype.add_feature.call(Session, new Soup.ProxyResolverDefault());

function Indicator(metadata) {
  this._init(metadata)
}

Indicator.prototype = {

  // Build over a Shell PanelMenu.ButtonBox
  __proto__: PanelMenu.ButtonBox.prototype,

  // Intialize object
  _init: function(metadata) {

    PanelMenu.ButtonBox.prototype._init.call(this, {
      reactive: true,
      can_focus: true,
      track_hover: true
    });

    // Store extension path
    this._path = metadata.path;

    // Add global status icon and button press binding
    this.actor.add_actor(this._newIcon('cistatus-settings'));
    this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));

    // Build left menu for projects
    this._leftMenu = new PopupMenu.PopupMenu(this.actor, 0.0, St.Side.TOP);
    Main.uiGroup.add_actor(this._leftMenu.actor);
    this._leftMenu.actor.hide();

    // Build right menu for settings
    this._rightMenu = new PopupMenu.PopupMenu(this.actor, 0.0, St.Side.TOP);
    Main.uiGroup.add_actor(this._rightMenu.actor);
    this._rightMenu.actor.hide();

    // Add settings editor
    this._settings = new Settings.Editor(this._path);

    // Add settings menu item to right menu
    let item = new PopupMenu.PopupMenuItem(_("Settings"));
    item.addActor(this._newIcon('cistatus-settings'));
    item.actor.connect('button-press-event', Lang.bind(this, this._editSettings));
    this._rightMenu.addMenuItem(item);

  },

  // Open settings dialog
  _editSettings: function(actor, event) {
    if (event.get_button() == 1) {
      this._settings.open(event.get_time());
    }
  },

  // Get CI's report
  _getStatusReport: function() {
    // Create new request message
    let message = Soup.Message.new('GET', this._settings.preferences.url);

    // Clean project list
    if (this._leftMenu.numMenuItems > 0) {
      this._leftMenu.removeAll();
    }

    // Preserve object context
    let self = this;

    // Fire request
    Session.queue_message(message, function() {
      let data = message.response_body.data;
      if (data != null) {
        self._updateStatus(new XML(data));
      }
    });

    // Keep refreshing according to settings interval
    Mainloop.timeout_add_seconds(
      this._settings.preferences.interval,
      Lang.bind(this, this._getStatusReport)
    );
  },

  // Load icon from local dir
  _newIcon: function(iconName) {
    let icon_uri = 'file://' + this._path + '/icons/' + iconName +'.png';
    return Texture.load_uri_async(icon_uri, 16, 16)
  },

  // Build new project menu item
  _newMenuItem: function(itemName){
    return new PopupMenu.PopupMenuItem(_(itemName))
  },

  // Dual click logic
  _onButtonPress: function(actor, event) {
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

  // Update project menu items and their statuses
  _updateStatus: function(data) {

    let anyFailure;

    for each(var project in data.Project) {

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
          iconName = 'cistatus-gray';
      }

      // Add a menu item and an icon for every project
      let menuItem = this._newMenuItem(projectName);
      menuItem.addActor(this._newIcon(iconName));

      // Bind project url
      menuItem.actor.connect('button-press-event', Lang.bind(this, function(){
        this._visitProjectUrl(projectUrl);
      }));

      // Add project to projects menu
      this._leftMenu.addMenuItem(menuItem);
    }

    // Update global status icon
    let globalStatus = anyFailure == true ? 'cistatus-red' : 'cistatus-green';
    this.actor.destroy_children();
    this.actor.add_actor(this._newIcon(globalStatus));
  },

  // Open project url in the default browser
  _visitProjectUrl: function(projectUrl) {
    GLib.spawn_async_with_pipes(null, ["gnome-www-browser", "-m", projectUrl], null,
                                GLib.SpawnFlags.SEARCH_PATH, null);
  },

  enable: function() {
    Main.panel._rightBox.insert_actor(this.actor, 0);
    Main.panel._menus.addMenu(this._rightMenu);
    Main.panel._menus.addMenu(this._leftMenu);

    if (this._settings.read()) {
      this._mainloop = Mainloop.timeout_add(0, Lang.bind(this, function() {
        this._getStatusReport();
      }));
    }
  },

  disable: function() {
    Mainloop.source_remove(this._mainloop);
    Main.panel._menus.removeMenu(this._leftMenu);
    Main.panel._menus.removeMenu(this._rightMenu);
    Main.panel._rightBox.remove_actor(this.actor);
  }
}

// Add signals for event bindings
Signals.addSignalMethods(Indicator.prototype);

function init(metadata) {
  return new Indicator(metadata)
}
