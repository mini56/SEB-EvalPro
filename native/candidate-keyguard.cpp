#define WIN32_LEAN_AND_MEAN
#include <windows.h>

static HHOOK g_hook = nullptr;

static bool keyDown(int vk) {
  return (GetAsyncKeyState(vk) & 0x8000) != 0;
}

static LRESULT CALLBACK keyboardProc(int code, WPARAM message, LPARAM data) {
  if (code >= 0 && (message == WM_KEYDOWN || message == WM_SYSKEYDOWN || message == WM_KEYUP || message == WM_SYSKEYUP)) {
    const auto* key = reinterpret_cast<KBDLLHOOKSTRUCT*>(data);
    const DWORD vk = key->vkCode;
    const bool alt = keyDown(VK_MENU);
    const bool ctrl = keyDown(VK_CONTROL);
    const bool winHeld = keyDown(VK_LWIN) || keyDown(VK_RWIN);

    // Edition Candidat : bloquer la touche Windows elle-même ainsi que
    // toutes les combinaisons Windows+... pour empêcher toute sortie vers le shell.
    if (vk == VK_LWIN || vk == VK_RWIN || winHeld) return 1;
    if (ctrl && vk == VK_ESCAPE) return 1;
    if (alt && (vk == VK_TAB || vk == VK_ESCAPE || vk == VK_SPACE || vk == VK_F4)) return 1;
  }
  return CallNextHookEx(g_hook, code, message, data);
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int) {
  g_hook = SetWindowsHookExW(WH_KEYBOARD_LL, keyboardProc, instance, 0);
  if (!g_hook) return 2;

  MSG msg{};
  while (GetMessageW(&msg, nullptr, 0, 0) > 0) {
    TranslateMessage(&msg);
    DispatchMessageW(&msg);
  }

  UnhookWindowsHookEx(g_hook);
  return 0;
}
