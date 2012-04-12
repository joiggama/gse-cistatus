const St = imports.gi.St;
const Main = imports.ui.main;

let panel_button, icon;

function init() {
  panel_button = new St.Bin({
    style_class: 'panel-button cistatus-panel',
    reactive: true,
    can_focus: true,
    x_fill: true,
    y_fill: true,
    track_hover: true
  });

  icon = new St.Icon({
    icon_name: 'cistatus-gray',
    icon_type: St.IconType.FULLCOLOR,
    icon_size: 16
  });

  panel_button.set_child(icon);
}

function enable() {
  Main.panel._rightBox.insert_actor(panel_button, 0);
}

function disable() {
  Main.panel._rightBox.remove_actor(panel_button);
}
