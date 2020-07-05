import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import toBe from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import { Popper } from 'react-popper';
// import _ from 'lodash/fp';

import './popups.scss';

import { removePopup } from 'reducers/popups';

const POPPER_MODIFIERS = {
  preventOverflow: {
    enabled: true,
    padding: 10,
    boundariesElement: 'viewport',
  },
};

const mapStateToProps = (state) => {
  return {
    popups: state.popups.popups,
  };
};

const mapDispatchToProps = {
  removePopup,
};

const Popups = ({ popups, removePopup }) => {
  const [visiblePopup, setVisiblePopup] = useState(null);
  const popupRef = useRef(null);

  useEffect(() => {
    if (popups.length > 0) {
      const popup = popups[0];
      setVisiblePopup(popup);
      setTimeout(() => {
        popupRef.current.style.opacity = 0;
        setTimeout(() => {
          removePopup(popup.id);
        }, popup.fadeOut || 3000);
      }, popup.timeout || 5000);
    }
  }, [popups])

  return (
    <div className="popups-holder">
    {ReactDOM.createPortal(
      <Popper
        container={document.body}
        modifiers={POPPER_MODIFIERS}
        placement={placement}
        referenceElement={this.containerItemRef.current}
      >
        {this.renderPopper}
      </Popper>,
      document.body
    )}
    </div>
  )
};
Popups.propTypes = {
  popups: toBe.array,
  removePopup: toBe.func,
};

  renderPopper({ ref, style, placement, arrowProps, scheduleUpdate, outOfBoundaries }) {
    const { children, hideWhenOutOfBounds } = this.props;
    return (
      <div
        ref={ref}
        style={style}
        data-placement={placement}
        className={classNames(
          'inner-popper-overlay',
          `arrow-${getArrowPlacement(placement)}`,
          this.props.overlayClassName,
          { 'out-of-bounds': outOfBoundaries && hideWhenOutOfBounds }
        )}
      >
        <div className="arrow-hider">
          <div className="arrow" ref={arrowProps.ref} style={arrowProps.style} />
        </div>
        <div
          className="inner-popper-content"
          // ref={ref => this.setupPopperContentRef(scheduleUpdate, ref)}
        >
          {children}
        </div>
      </div>
    );
  }

  render() {
    const { placement, overlayItem } = this.props;
    const { isVisible } = this.state;
    return (
      <React.Fragment>
        <div
          className="overlay-item"
          ref={this.containerItemRef}
          onClick={this.toggleOverlayVisibility}
        >
          {overlayItem}
        </div>
        {isVisible &&
          ReactDOM.createPortal(
            <Popper
              container={document.body}
              modifiers={POPPER_MODIFIERS}
              placement={placement}
              referenceElement={this.containerItemRef.current}
            >
              {this.renderPopper}
            </Popper>,
            document.body
          )}
      </React.Fragment>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Popups);
