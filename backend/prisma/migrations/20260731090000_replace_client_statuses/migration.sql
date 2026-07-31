-- Спочатку тимчасово дозволяємо старі й нові значення, щоб перенести дані без втрат.
ALTER TABLE `Client`
  MODIFY `status` ENUM(
    'NEW',
    'IN_PROGRESS',
    'CONTACTED',
    'WAITING',
    'INTERESTED',
    'NOT_INTERESTED',
    'CLIENT',
    'REJECTED',
    'ARCHIVED',
    'NO_ANSWER',
    'CALL_LATER',
    'FUTURE_PROSPECT',
    'LOST'
  ) NOT NULL DEFAULT 'NEW';

UPDATE `Client`
SET `status` = CASE
  WHEN `status` = 'IN_PROGRESS' THEN 'INTERESTED'
  WHEN `status` = 'CONTACTED' THEN 'FUTURE_PROSPECT'
  WHEN `status` = 'WAITING' THEN 'CALL_LATER'
  WHEN `status` IN ('NOT_INTERESTED', 'REJECTED', 'ARCHIVED') THEN 'LOST'
  WHEN `status` = 'CLIENT' THEN 'INTERESTED'
  ELSE `status`
END;

ALTER TABLE `Client`
  MODIFY `status` ENUM(
    'NEW',
    'NO_ANSWER',
    'CALL_LATER',
    'FUTURE_PROSPECT',
    'INTERESTED',
    'LOST'
  ) NOT NULL DEFAULT 'NEW';
