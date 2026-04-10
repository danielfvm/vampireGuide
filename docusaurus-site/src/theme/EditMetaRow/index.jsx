import React from 'react';
import clsx from 'clsx';
import LastUpdated from '@theme/LastUpdated';
import PageActions from '@site/src/components/PageActions';
import styles from './styles.module.css';

export default function EditMetaRow({
  className,
  editUrl,
  lastUpdatedAt,
  lastUpdatedBy,
}) {
  return (
    <div className={clsx('row', className)}>
      <div className={clsx('col', styles.actionsCol)}>
        <PageActions editUrl={editUrl} />
      </div>
      <div className={clsx('col', styles.lastUpdated)}>
        {(lastUpdatedAt || lastUpdatedBy) && (
          <LastUpdated
            lastUpdatedAt={lastUpdatedAt}
            lastUpdatedBy={lastUpdatedBy}
          />
        )}
      </div>
    </div>
  );
}
