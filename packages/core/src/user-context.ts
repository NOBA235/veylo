import type { GetUserContextInput, GetUserContextOutput, UserDevice, UserInventoryItem } from "@veylo/types";
import type { CoreContext, UserContextStore } from "./context";

export const DEFAULT_USER_DEVICES: UserDevice[] = [
  {
    id: "dev-macbook-m3",
    userId: "default",
    deviceType: "laptop",
    brand: "Apple",
    model: "MacBook Pro M3",
    connector: "usb-c",
    notes: "Thunderbolt 4 / USB-C ports only",
  },
  {
    id: "dev-iphone-15",
    userId: "default",
    deviceType: "phone",
    brand: "Apple",
    model: "iPhone 15 Pro",
    connector: "usb-c",
    notes: "USB-C port (supports DisplayPort Alternate Mode)",
  },
  {
    id: "dev-bravia-tv",
    userId: "default",
    deviceType: "tv",
    brand: "Sony",
    model: "Bravia 4K OLED",
    connector: "hdmi",
    notes: "HDMI 2.1 ports",
  },
];

export const DEFAULT_USER_INVENTORY: UserInventoryItem[] = [
  {
    id: "inv-hdmi-adapter",
    userId: "default",
    productId: "USB-C to HDMI adapter",
    acquiredAt: "2026-08-14T09:30:00Z",
    source: "purchased",
    notes: "Space gray USB-C to HDMI adapter in home office desk",
  },
  {
    id: "inv-ptfe-tape",
    userId: "default",
    productId: "PTFE tape",
    acquiredAt: "2026-06-10T14:15:00Z",
    source: "already_owned",
    notes: "1/2 inch thread seal tape in toolbox",
  },
];

export class InMemoryUserContextStore implements UserContextStore {
  private readonly devices = new Map<string, UserDevice[]>();
  private readonly inventory = new Map<string, UserInventoryItem[]>();

  constructor(initialDevices = DEFAULT_USER_DEVICES, initialInventory = DEFAULT_USER_INVENTORY) {
    for (const d of initialDevices) {
      const list = this.devices.get(d.userId) ?? [];
      list.push(d);
      this.devices.set(d.userId, list);
    }
    for (const item of initialInventory) {
      const list = this.inventory.get(item.userId) ?? [];
      list.push(item);
      this.inventory.set(item.userId, list);
    }
  }

  async getUserContext(userId: string): Promise<{ devices: UserDevice[]; inventory: UserInventoryItem[] }> {
    // If specific user has records, return them; otherwise fallback to default seed for demo reliability
    const userDevs = this.devices.get(userId);
    const userInv = this.inventory.get(userId);
    const fallbackDevs = this.devices.get("default") ?? DEFAULT_USER_DEVICES;
    const fallbackInv = this.inventory.get("default") ?? DEFAULT_USER_INVENTORY;

    return {
      devices: userDevs && userDevs.length > 0 ? userDevs : fallbackDevs,
      inventory: userInv && userInv.length > 0 ? userInv : fallbackInv,
    };
  }

  async addDevice(device: UserDevice): Promise<void> {
    const list = this.devices.get(device.userId) ?? [];
    list.push(device);
    this.devices.set(device.userId, list);
  }

  async addInventoryItem(item: UserInventoryItem): Promise<void> {
    const list = this.inventory.get(item.userId) ?? [];
    list.push(item);
    this.inventory.set(item.userId, list);
  }
}

export async function getUserContext(
  ctx: CoreContext,
  input: GetUserContextInput
): Promise<GetUserContextOutput> {
  const store = ctx.userContext ?? new InMemoryUserContextStore();
  const context = await store.getUserContext(input.userId);

  return {
    userId: input.userId,
    devices: context.devices,
    inventory: context.inventory,
  };
}

