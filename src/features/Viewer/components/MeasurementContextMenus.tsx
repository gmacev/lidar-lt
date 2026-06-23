import { MeasurementContext } from './MeasurementContext';
import type { MeasurementContextMenuModel } from '@/features/Viewer/hooks/useViewerTools';

interface MeasurementContextMenusProps {
    menus: MeasurementContextMenuModel[];
}

export function MeasurementContextMenus({ menus }: MeasurementContextMenusProps) {
    return (
        <>
            {menus.map((menu) => (
                <MeasurementContext
                    key={menu.id}
                    x={menu.position.x}
                    y={menu.position.y}
                    onClose={menu.onClose}
                    onDeleteLast={menu.onDeleteLast}
                    onDeleteAll={menu.onDeleteAll}
                    onExportCsv={menu.onExportCsv}
                    disableExport={menu.disableExport}
                />
            ))}
        </>
    );
}
