import React, {useMemo} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Translate from '@docusaurus/Translate';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useLocation} from '@docusaurus/router';
import {ThemeClassNames} from '@docusaurus/theme-common';
import EditThisPage from '@theme/EditThisPage';
import IconExternalLink from '@theme/Icon/ExternalLink';
import styles from './PageActions.module.css';

function createIssueUrl({organizationName, projectName, pageUrl, pagePath, editUrl}) {
  if (!organizationName || !projectName || !pageUrl) {
    return null;
  }

  const title = `Issue on ${pagePath}`;
  const body = [
    `Page: ${pageUrl}`,
    editUrl ? `Source: ${editUrl}` : null,
    '',
    'What is wrong on this page?',
    '',
    '',
    'Additional context:',
  ]
    .filter(Boolean)
    .join('\n');

  const params = new URLSearchParams({title, body});
  return `https://github.com/${organizationName}/${projectName}/issues/new?${params.toString()}`;
}

export default function PageActions({editUrl, className}) {
  const {siteConfig} = useDocusaurusContext();
  const {pathname, search, hash} = useLocation();

  const issueUrl = useMemo(() => {
    const {organizationName, projectName, url, baseUrl = '/'} = siteConfig;
    const pageUrl = url ? new URL(`${pathname}${search}${hash}`, url).toString() : null;
    const pagePath = pathname.startsWith(baseUrl)
      ? pathname.slice(baseUrl.length) || '/'
      : pathname || '/';

    return createIssueUrl({
      organizationName,
      projectName,
      pageUrl,
      pagePath,
      editUrl,
    });
  }, [editUrl, hash, pathname, search, siteConfig]);

  if (!editUrl && !issueUrl) {
    return null;
  }

  return (
    <div className={clsx(styles.actions, className)}>
      {editUrl && <EditThisPage editUrl={editUrl} />}
      {issueUrl && (
        <Link
          to={issueUrl}
          className={clsx(ThemeClassNames.common.editThisPage, styles.reportIssue)}
          target="_blank"
          rel="noopener noreferrer">
          <IconExternalLink />
          <Translate
            id="theme.common.reportIssue"
            description="The link label to report an issue for the current page">
            Report issue
          </Translate>
        </Link>
      )}
    </div>
  );
}
