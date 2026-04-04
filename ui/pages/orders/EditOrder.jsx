'use client';

import { useState } from 'react';
import { CldImage } from 'next-cloudinary';
import {
  MdCheckCircle,
  MdPending,
  MdError,
  MdUndo,
  MdRefresh,
  MdSave,
  MdCancel,
  MdEdit,
  MdShoppingCart,
  MdPayment,
  MdPerson,
  MdDateRange,
  MdCategory,
  MdLink,
  MdStar,
  MdAttachMoney,
  MdCreditCard,
} from 'react-icons/md';
import styles from '@/ui/styling/dashboard/orders/editOrder.module.css';
import { updateOrderPaymentStatus } from '@/app/dashboard/orders/actions';

const EditOrder = ({ order }) => {
  const [currentStatus, setCurrentStatus] = useState(
    order.order_payment_status,
  );
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const statusOptions = [
    { value: 'unpaid', label: 'En attente', icon: MdPending, color: '#f59e0b' },
    { value: 'paid', label: 'Payée', icon: MdCheckCircle, color: '#10b981' },
    { value: 'refunded', label: 'Remboursée', icon: MdUndo, color: '#6366f1' },
    { value: 'failed', label: 'Échouée', icon: MdError, color: '#ef4444' },
  ];

  const handleStatusUpdate = async () => {
    if (currentStatus === order.order_payment_status) {
      setIsEditing(false);
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await updateOrderPaymentStatus(
        order.order_id,
        currentStatus,
      );

      if (result.success) {
        setMessage({
          type: 'success',
          text: 'Statut mis à jour avec succès !',
        });
        setIsEditing(false);
        order.order_payment_status = currentStatus;

        if (result.order.paid_at) order.order_paid_at = result.order.paid_at;
        if (result.order.cancelled_at)
          order.order_cancelled_at = result.order.cancelled_at;
      } else {
        throw new Error('Échec de la mise à jour');
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      setMessage({
        type: 'error',
        text: 'Erreur lors de la mise à jour du statut',
      });
      setCurrentStatus(order.order_payment_status);
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleCancel = () => {
    setCurrentStatus(order.order_payment_status);
    setIsEditing(false);
    setMessage(null);
  };

  const getStatusInfo = (status) =>
    statusOptions.find((option) => option.value === status) || statusOptions[0];

  const formatPrice = (price) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  const currentStatusInfo = getStatusInfo(currentStatus);
  const StatusIcon = currentStatusInfo.icon;
  const totalAmount = order.order_price + order.order_rent;

  return (
    <div className={styles.container}>
      {/* Message de notification */}
      {message && (
        <div className={`${styles.message} ${styles[message.type]}`}>
          {message.text}
        </div>
      )}

      {/* En-tête */}
      <div className={styles.header}>
        <div className={styles.orderInfo}>
          <div className={styles.orderIdSection}>
            <MdShoppingCart className={styles.headerIcon} />
            <div>
              <h1 className={styles.orderId}>
                #{order.order_id.substring(0, 8)}
              </h1>
              <p className={styles.orderDate}>
                Créée le {formatDate(order.order_created)}
              </p>
            </div>
          </div>

          <div className={styles.priceSection}>
            <div className={styles.priceBreakdown}>
              <div className={styles.priceItem}>
                <span className={styles.priceLabel}>Prix:</span>
                <span className={styles.priceValue}>
                  {formatPrice(order.order_price)}
                </span>
              </div>
              {order.order_rent > 0 && (
                <div className={styles.priceItem}>
                  <span className={styles.priceLabel}>Abonnement/mois:</span>
                  <span className={styles.rentValue}>
                    {formatPrice(order.order_rent)}
                  </span>
                </div>
              )}
            </div>
            <div className={styles.totalPrice}>{formatPrice(totalAmount)}</div>
            <div className={styles.totalLabel}>Total</div>
          </div>
        </div>

        {/* Statut */}
        <div className={styles.statusSection}>
          <div className={styles.statusHeader}>
            <h3>Statut de paiement</h3>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className={styles.editButton}
                disabled={loading}
              >
                <MdEdit />
                Modifier
              </button>
            )}
          </div>

          {isEditing ? (
            <div className={styles.statusEditor}>
              <div className={styles.statusOptions}>
                {statusOptions.map((option) => {
                  const OptionIcon = option.icon;
                  return (
                    <label
                      key={option.value}
                      className={`${styles.statusOption} ${
                        currentStatus === option.value ? styles.selected : ''
                      }`}
                      style={{ '--status-color': option.color }}
                    >
                      <input
                        type="radio"
                        name="status"
                        value={option.value}
                        checked={currentStatus === option.value}
                        onChange={(e) => setCurrentStatus(e.target.value)}
                        className={styles.statusRadio}
                      />
                      <div className={styles.statusOptionContent}>
                        <OptionIcon className={styles.statusOptionIcon} />
                        <span className={styles.statusOptionLabel}>
                          {option.label}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className={styles.statusActions}>
                <button
                  onClick={handleStatusUpdate}
                  disabled={
                    loading || currentStatus === order.order_payment_status
                  }
                  className={styles.saveButton}
                >
                  {loading ? (
                    <>
                      <MdRefresh className={styles.loadingIcon} />
                      Mise à jour...
                    </>
                  ) : (
                    <>
                      <MdSave />
                      Sauvegarder
                    </>
                  )}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className={styles.cancelButton}
                >
                  <MdCancel />
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.currentStatus}>
              <div
                className={styles.statusBadge}
                style={{ '--status-color': currentStatusInfo.color }}
              >
                <StatusIcon className={styles.statusIcon} />
                <span className={styles.statusText}>
                  {currentStatusInfo.label}
                </span>
              </div>
              {order.order_paid_at && currentStatus === 'paid' && (
                <p className={styles.statusDate}>
                  Payée le {formatDate(order.order_paid_at)}
                </p>
              )}
              {order.order_cancelled_at &&
                (currentStatus === 'refunded' ||
                  currentStatus === 'failed') && (
                  <p className={styles.statusDate}>
                    {currentStatus === 'refunded' ? 'Remboursée' : 'Échouée'} le{' '}
                    {formatDate(order.order_cancelled_at)}
                  </p>
                )}
            </div>
          )}
        </div>
      </div>

      {/* Contenu principal */}
      <div className={styles.content}>
        {/* Section Produit */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <MdCategory className={styles.sectionIcon} />
            <h2>Produit commandé</h2>
          </div>

          <div className={styles.productCard}>
            <div className={styles.productImage}>
              {order.application.images?.length > 0 ? (
                <CldImage
                  src={order.application.images[0]}
                  alt={order.application.name}
                  width={120}
                  height={120}
                  className={styles.productImg}
                />
              ) : (
                <div className={styles.noImage}>
                  <MdShoppingCart />
                </div>
              )}
            </div>

            <div className={styles.productDetails}>
              <h3 className={styles.productName}>{order.application.name}</h3>
              <div className={styles.productMeta}>
                <span className={styles.productCategory}>
                  {order.application.category}
                </span>
                <div className={styles.productLevel}>
                  <MdStar className={styles.starIcon} />
                  <span>Niveau {order.application.level}</span>
                </div>
              </div>

              {order.application.description && (
                <p className={styles.productDescription}>
                  {order.application.description}
                </p>
              )}

              <div className={styles.productPricing}>
                <div className={styles.priceItem}>
                  <span className={styles.priceLabel}>Frais :</span>
                  <span className={styles.priceValue}>
                    {formatPrice(order.application.fee)}
                  </span>
                </div>
                <div className={styles.priceItem}>
                  <span className={styles.priceLabel}>Location/mois :</span>
                  <span className={styles.priceValue}>
                    {formatPrice(order.application.rent)}
                  </span>
                </div>
              </div>

              {order.application.link && (
                <a
                  href={order.application.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.productLink}
                >
                  <MdLink className={styles.linkIcon} />
                  Voir l&apos;application
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Section Client */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <MdPerson className={styles.sectionIcon} />
            <h2>Informations client</h2>
          </div>

          <div className={styles.clientCard}>
            <div className={styles.clientField}>
              <span className={styles.fieldLabel}>Nom complet :</span>
              <span className={styles.fieldValue}>{order.client.fullName}</span>
            </div>
            <div className={styles.clientField}>
              <span className={styles.fieldLabel}>Email :</span>
              <span className={styles.fieldValue}>{order.client.email}</span>
            </div>
            <div className={styles.clientField}>
              <span className={styles.fieldLabel}>Téléphone :</span>
              <span className={styles.fieldValue}>{order.client.phone}</span>
            </div>
          </div>
        </div>

        {/* Section Paiement */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <MdPayment className={styles.sectionIcon} />
            <h2>Méthodes de paiement</h2>
          </div>

          <div className={styles.paymentCard}>
            {order.hasCashPayment && (
              <div className={styles.paymentField}>
                <span className={styles.fieldLabel}>Type :</span>
                <span className={styles.cashBadge}>💵 Inclut du CASH</span>
              </div>
            )}

            {order.platforms.map((platform) => (
              <div key={platform.id} className={styles.paymentSubsection}>
                <h4 className={styles.subsectionTitle}>
                  {platform.is_cash_payment ? (
                    <MdAttachMoney className={styles.subsectionIcon} />
                  ) : (
                    <MdCreditCard className={styles.subsectionIcon} />
                  )}
                  {platform.name}
                  {platform.is_cash_payment && (
                    <span className={styles.cashBadge}>💵 CASH</span>
                  )}
                </h4>

                {platform.description && (
                  <div className={styles.paymentField}>
                    <span className={styles.fieldLabel}>Description :</span>
                    <span className={styles.fieldValue}>
                      {platform.description}
                    </span>
                  </div>
                )}

                {!platform.is_cash_payment && platform.account_name && (
                  <div className={styles.paymentField}>
                    <span className={styles.fieldLabel}>Compte :</span>
                    <span className={styles.fieldValue}>
                      {platform.account_name}
                    </span>
                  </div>
                )}

                {!platform.is_cash_payment && platform.account_number && (
                  <div className={styles.paymentField}>
                    <span className={styles.fieldLabel}>Numéro :</span>
                    <span className={styles.fieldValue}>
                      {platform.account_number}
                    </span>
                  </div>
                )}
              </div>
            ))}

            {order.platforms.length === 0 && (
              <div className={styles.paymentField}>
                <span className={styles.fieldValue}>
                  Aucune plateforme enregistrée
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Section Dates */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <MdDateRange className={styles.sectionIcon} />
            <h2>Historique</h2>
          </div>

          <div className={styles.datesCard}>
            <div className={styles.dateField}>
              <span className={styles.fieldLabel}>Créée le :</span>
              <span className={styles.fieldValue}>
                {formatDate(order.order_created)}
              </span>
            </div>
            <div className={styles.dateField}>
              <span className={styles.fieldLabel}>Mise à jour :</span>
              <span className={styles.fieldValue}>
                {formatDate(order.order_updated)}
              </span>
            </div>
            {order.order_paid_at && (
              <div className={styles.dateField}>
                <span className={styles.fieldLabel}>Payée le :</span>
                <span className={styles.fieldValue}>
                  {formatDate(order.order_paid_at)}
                </span>
              </div>
            )}
            {order.order_cancelled_at && (
              <div className={styles.dateField}>
                <span className={styles.fieldLabel}>
                  {order.order_payment_status === 'refunded'
                    ? 'Remboursée le :'
                    : 'Échouée le :'}
                </span>
                <span className={styles.fieldValue}>
                  {formatDate(order.order_cancelled_at)}
                </span>
              </div>
            )}
            {order.order_cancel_reason && (
              <div className={styles.dateField}>
                <span className={styles.fieldLabel}>
                  Raison d&apos;annulation :
                </span>
                <span className={styles.fieldValue}>
                  {order.order_cancel_reason}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditOrder;
