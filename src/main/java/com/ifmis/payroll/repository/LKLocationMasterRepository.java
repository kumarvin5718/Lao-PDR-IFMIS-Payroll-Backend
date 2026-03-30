package com.ifmis.payroll.repository;

import com.ifmis.payroll.entity.master.LKLocationMaster;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface LKLocationMasterRepository extends JpaRepository<LKLocationMaster, UUID> {
    Optional<LKLocationMaster> findByCountry_CountryKeyAndProvince_ProvinceKeyAndDistrict_DistrictKey(
            String countryKey,
            String provinceKey,
            String districtKey
    );
}
