#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use mac_address::get_mac_address;

#[tauri::command]
fn get_mac_addresses() -> Result<Vec<String>, String> {
  match get_mac_address() {
    Ok(Some(mac)) => Ok(vec![mac.to_string()]),
    Ok(None) => Ok(Vec::new()),
    Err(e) => Err(format!("failed to get MAC address: {}", e)),
  }
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![get_mac_addresses])
    .run(tauri::generate_context!())
    .expect("error while running tauri application")
}
