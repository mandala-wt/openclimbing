import { useState } from 'react';
import BookmarkBorder from '@mui/icons-material/BookmarkBorder';
import { featureToItem } from '../../../services/my-lists/featureToItem';
import { isViaFerrataTags } from '../../../services/tagging/viaFerrataScale';
import { useFeatureContext } from '../../utils/FeatureContext';
import { ListPickerDialog } from '../../MyLists/ListPickerDialog';
import { QuickActionButton } from './QuickActionButton';

export const FerrataListActions = () => {
  const { feature } = useFeatureContext();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (
    feature.point ||
    !feature.osmMeta?.id ||
    !feature.center ||
    !isViaFerrataTags(feature.tags)
  ) {
    return null;
  }
  const item = featureToItem(feature);

  // Favourite, visited, notes and videos: see Kletterglueck/TourDetails.
  return (
    <>
      <QuickActionButton
        icon={BookmarkBorder}
        label="Zu Listen"
        onClick={() => setPickerOpen(true)}
      />
      <ListPickerDialog
        key={item.shortId}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        item={item}
      />
    </>
  );
};
