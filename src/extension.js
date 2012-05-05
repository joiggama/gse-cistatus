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
const Session = new Soup.SessionAsync();
// Allow Session to work under a proxy http://goo.gl/KKCYe
Soup.Session.prototype.add_feature.call(Session, new Soup.ProxyResolverDefault());

// Create texture cache for icons load
const Texture = St.TextureCache.get_default();

function Indicator(metadata) {
  this._init(metadata)
}

Indicator.prototype = {
  __proto__: PanelMenu.ButtonBox.prototype,

  _init: function(metadata) {
    PanelMenu.ButtonBox.prototype._init.call(this, { reactive: true });
    this._path = metadata.path;
    this._settings = new Settings.Editor(this._path);
    this._buildControls();
  },

  // Build indicator controls
  _buildControls: function() {
    this.actor.add_actor(this._newIcon('cistatus-settings'));
    this.actor.connect('button-press-event', Lang.bind(this, this._onClick));

    this._leftMenu = new PopupMenu.PopupMenu(this.actor, 0.0, St.Side.TOP);
    this._leftMenu.actor.hide();

    this._rightMenu = new PopupMenu.PopupMenu(this.actor, 0.0, St.Side.TOP);
    this._rightMenu.actor.hide();

    let item = new PopupMenu.PopupMenuItem(_("Settings"));
    item.addActor(this._newIcon('cistatus-settings'));
    item.actor.connect('button-press-event', Lang.bind(this._settings, this._settings.open));
    this._rightMenu.addMenuItem(item);
  },

  // Get CI's report
  _getStatusReport: function() {
    let message = Soup.Message.new('GET', this._settings.preferences.url);

    if (this._leftMenu.numMenuItems > 0) {
      this._leftMenu.removeAll();
    }

    let self = this;

    Session.queue_message(message, function() {
      let data = message.response_body.data;
      if (data != null) {
        self._updateStatus(new XML(data));
      }
    });

    Mainloop.timeout_add_seconds(
      this._settings.preferences.interval,
      Lang.bind(this, this._getStatusReport)
    );
  },

  // Load icon from local dir
  _newIcon: function(iconName) {
    let icon_uri = 'file://' + this._path + '/icons/' + iconName +'.png';
    return Texture.load_uri_async(icon_uri, 16, 16);
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

  // Update project menu items and their statuses
  _updateStatus: function(data) {
    let anyFailure;
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
          iconName = 'cistatus-gray';
      }

      let menuItem = this._newMenuItem(projectName);
      menuItem.addActor(this._newIcon(iconName));

      menuItem.actor.connect('button-press-event', Lang.bind(this, function(){
        this._visitProjectUrl(projectUrl);
      }));

      this._leftMenu.addMenuItem(menuItem);
    }

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
    Main.uiGroup.add_actor(this._rightMenu.actor);
    Main.panel._menus.addMenu(this._rightMenu);
    Main.uiGroup.add_actor(this._leftMenu.actor);
    Main.panel._menus.addMenu(this._leftMenu);

    if (this._settings.read()) {
      this._mainloop = Mainloop.timeout_add(0, Lang.bind(this, function() {
        this._getStatusReport();
      }));
    }
  },

  disable: function() {
    Mainloop.source_remove(this._mainloop);
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
