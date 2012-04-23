const GLib      = imports.gi.GLib;
const Lang      = imports.lang;
const Main      = imports.ui.main;
const Mainloop  = imports.mainloop;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Signals   = imports.signals;
const Soup      = imports.gi.Soup;
const St        = imports.gi.St;

// Prevent Session from being garbage collected http://goo.gl/KKCYe
const Session   = new Soup.SessionAsync();

// Texture cache to load icons
const Texture   = St.TextureCache.get_default();

// Settings
const CI_URL = 'http://ci.jenkins-ci.org/cc.xml';
const LOOP_INTERVAL = 60;

// Allow Session work under a proxy http://goo.gl/KKCYe
Soup.Session.prototype.add_feature.call(Session, new Soup.ProxyResolverDefault());

function Indicator(metadata) {
  this._init(metadata)
}

Indicator.prototype = {

  __proto__: PanelMenu.ButtonBox.prototype,

  _init: function(metadata) {

    PanelMenu.ButtonBox.prototype._init.call(this, {
      reactive: true,
      can_focus: true,
      track_hover: true
    });

    // Store extension path
    this._path = metadata.path;

    // Add global status icon and button press binding
    this.actor.add_actor(this._newStatusIcon('cistatus-gray'));
    this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));

    // Build left menu for projects
    this._leftMenu = new PopupMenu.PopupMenu(this.actor, 0.0, St.Side.TOP);
    Main.uiGroup.add_actor(this._leftMenu.actor);
    this._leftMenu.actor.hide();

    // Build right menu for settings
    this._rightMenu = new PopupMenu.PopupMenu(this.actor, 0.0, St.Side.TOP);
    Main.uiGroup.add_actor(this._rightMenu.actor);
    this._rightMenu.actor.hide();

    let item = new PopupMenu.PopupMenuItem(_("Settings"));
    this._rightMenu.addMenuItem(item);

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

  // Get CI's report and call updateStatus after request completes
  _getStatusReport: function() {

    // Clean project list
    if (this._leftMenu.numMenuItems > 0) {
      this._leftMenu.removeAll();
    }

    let self = this;
    let message = Soup.Message.new('GET', CI_URL);

    Session.queue_message(message, function() {
      let data = message.response_body.data;
      if (data != null) {
        self._updateStatus(new XML(data));
      }
    });

    // Keep refreshing every LOOP INTERVAL value in seconds
    Mainloop.timeout_add_seconds(
      LOOP_INTERVAL,
      Lang.bind(this, this._getStatusReport)
    );
  },

  // Build new project status icon
  _newStatusIcon: function(iconName) {
    let icon_uri = 'file://' + this._path + '/icons/' + iconName +'.png';
    return Texture.load_uri_async(icon_uri, 16, 16)
  },

  // Build new project menu item
  _newMenuItem: function(itemName){
    return new PopupMenu.PopupMenuItem(_(itemName))
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
      menuItem.addActor(this._newStatusIcon(iconName));

      // Bind project url
      menuItem.actor.connect('button-press-event', Lang.bind(this, function(){
        this._visitProjectUrl(projectUrl);
      }));

      this._leftMenu.addMenuItem(menuItem);
    }

    // Update global status icon
    let globalStatus = anyFailure == true ? 'cistatus-red' : 'cistatus-green';
    this.actor.destroy_children();
    this.actor.add_actor(this._newStatusIcon(globalStatus));
  },

  // Open project url in the default browser
  _visitProjectUrl: function(projectUrl) {
    GLib.spawn_async_with_pipes(null, ["gnome-www-browser","-m", projectUrl],
      null, GLib.SpawnFlags.SEARCH_PATH, null);
  },

  enable: function() {
    Main.panel._rightBox.insert_actor(this.actor, 0);
    Main.panel._menus.addMenu(this._rightMenu);
    Main.panel._menus.addMenu(this._leftMenu);

    this._mainloop = Mainloop.timeout_add(0, Lang.bind(this, function() {
      this._getStatusReport();
    }));
  },

  disable: function() {
    Mainloop.source_remove(this._mainloop);
    Main.panel._menus.removeMenu(this._leftMenu);
    Main.panel._rightBox.remove_actor(this.actor);
  }
}
// Add signals for event bindings
Signals.addSignalMethods(Indicator.prototype);

function init(metadata) {
  return new Indicator(metadata)
}
